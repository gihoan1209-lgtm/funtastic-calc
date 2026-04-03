import { NextResponse } from 'next/server'
import crypto from 'crypto'

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

async function fetchNaverKeywords(keyword, customerId, accessKey, secretKey) {
  const timestamp = Date.now().toString()
  const signature = makeSignature(timestamp, 'GET', '/keywordstool', secretKey)
  try {
    const resp = await fetch(
      `https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(keyword)}&showDetail=1`,
      {
        headers: {
          'X-Timestamp': timestamp,
          'X-API-KEY': accessKey,
          'X-Customer': customerId,
          'X-Signature': signature,
        },
      }
    )
    if (!resp.ok) return []
    const data = await resp.json()
    return data.keywordList || []
  } catch { return [] }
}

async function getAIRecommended(product, keywords) {
  try {
    const kwList = keywords.map(k => k.keyword).join(', ')
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: '한국 이커머스 키워드 전문가입니다. 반드시 JSON 배열만 출력하세요. 다른 텍스트 없이 순수 JSON 배열만.',
        messages: [{
          role: 'user',
          content: `상품: "${product}"\n\n아래 키워드 목록에서 이 상품과 가장 연관성 높은 키워드 20개를 골라 JSON 배열로 반환하세요.\n연관성 기준: 같은 카테고리, 유사 상품, 구매 의도가 있는 검색어 위주로.\n\n키워드 목록: ${kwList}\n\n출력 형식: ["키워드1", "키워드2", ...]`
        }],
      }),
    })
    const data = await resp.json()
    const text = data.content?.map(c => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    console.error('AI error:', e)
    return []
  }
}

export async function POST(req) {
  const { product } = await req.json()
  if (!product) return NextResponse.json({ error: '상품명을 입력해주세요' }, { status: 400 })

  const customerId = process.env.NAVER_CUSTOMER_ID
  const accessKey = process.env.NAVER_ACCESS_LICENSE
  const secretKey = process.env.NAVER_SECRET_KEY

  const words = product.trim().split(/\s+/).filter(w => w.length >= 2)
  const searchTerms = [product, ...words].slice(0, 3)

  const results = await Promise.all(
    searchTerms.map(term => fetchNaverKeywords(term, customerId, accessKey, secretKey))
  )

  const seen = new Set()
  const merged = []
  for (const list of results) {
    for (const k of list) {
      if (!seen.has(k.relKeyword)) {
        seen.add(k.relKeyword)
        merged.push(k)
      }
    }
  }

  const total = (k) => k.pc + k.mobile
  const sorted = merged
    .map(k => ({
      keyword: k.relKeyword,
      pc: k.monthlyPcQcCnt === '< 10' ? 5 : Number(k.monthlyPcQcCnt) || 0,
      mobile: k.monthlyMobileQcCnt === '< 10' ? 5 : Number(k.monthlyMobileQcCnt) || 0,
      competition: k.compIdx,
    }))
    .sort((a, b) => total(b) - total(a))

  const naverKeywords = {
    high:  sorted.filter(k => total(k) >= 10000),
    mid:   sorted.filter(k => total(k) >= 1000 && total(k) < 10000),
    low:   sorted.filter(k => total(k) >= 100  && total(k) < 1000),
    niche: sorted.filter(k => total(k) < 100),
  }

  // AI 추천 키워드 (전체 키워드 중 연관성 높은 20개)
  let aiRecommended = []
  if (sorted.length > 0) {
    const recommended = await getAIRecommended(product, sorted)
    // 검색량 데이터랑 매핑
    aiRecommended = recommended
      .map(kw => sorted.find(k => k.keyword === kw))
      .filter(Boolean)
  }

  // 네이버쇼핑 자동완성
  let naverShopping = []
  try {
    const resp = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(product)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://shopping.naver.com' } }
    )
    if (resp.ok) {
      const data = await resp.json()
      const items = data.items?.[0] || []
      naverShopping = items
        .map(item => Array.isArray(item) ? item[0] : item)
        .filter(s => s && typeof s === 'string')
        .slice(0, 10)
    }
  } catch (e) { console.error('Naver shopping error:', e) }

  // 쿠팡 자동완성
  let coupang = []
  try {
    const resp = await fetch(
      `https://www.coupang.com/np/search/autoComplete?keyword=${encodeURIComponent(product)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.coupang.com' } }
    )
    if (resp.ok) {
      const text = await resp.text()
      const json = JSON.parse(text)
      const suggests = json.suggests || json.data || (Array.isArray(json) ? json : [])
      coupang = suggests
        .map(s => typeof s === 'string' ? s : s.value || s.keyword || s.text || '')
        .filter(s => s)
        .slice(0, 10)
    }
  } catch (e) { console.error('Coupang error:', e) }

  return NextResponse.json({ keywords: naverKeywords, naverShopping, coupang, aiRecommended })
}
