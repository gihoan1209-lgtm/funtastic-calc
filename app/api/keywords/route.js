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

// 연관성 점수 계산
function relevanceScore(keyword, productWords) {
  let score = 0
  for (const word of productWords) {
    if (word.length < 2) continue
    if (keyword === word) score += 10         // 완전 일치
    else if (keyword.startsWith(word)) score += 6  // 앞에서 일치
    else if (keyword.endsWith(word)) score += 5    // 뒤에서 일치
    else if (keyword.includes(word)) score += 4    // 포함
  }
  return score
}

export async function POST(req) {
  const { product } = await req.json()
  if (!product) return NextResponse.json({ error: '상품명을 입력해주세요' }, { status: 400 })

  const customerId = process.env.NAVER_CUSTOMER_ID
  const accessKey = process.env.NAVER_ACCESS_LICENSE
  const secretKey = process.env.NAVER_SECRET_KEY

  const productWords = product.trim().split(/\s+/).filter(w => w.length >= 2)
  const searchTerms = [product, ...productWords].slice(0, 3)

  const results = await Promise.all(
    searchTerms.map(term => fetchNaverKeywords(term, customerId, accessKey, secretKey))
  )

  // 중복 제거하며 합치기
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

  // AI 추천 대신 연관성 점수 기반으로 상위 20개 추출
  const aiRecommended = [...sorted]
    .map(k => ({ ...k, score: relevanceScore(k.keyword, productWords) }))
    .filter(k => k.score > 0)
    .sort((a, b) => b.score - a.score || total(b) - total(a))
    .slice(0, 20)

  const naverKeywords = {
    high:  sorted.filter(k => total(k) >= 10000),
    mid:   sorted.filter(k => total(k) >= 1000 && total(k) < 10000),
    low:   sorted.filter(k => total(k) >= 100  && total(k) < 1000),
    niche: sorted.filter(k => total(k) < 100),
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
