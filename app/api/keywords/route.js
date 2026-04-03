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

export async function POST(req) {
  const { product } = await req.json()
  if (!product) return NextResponse.json({ error: '상품명을 입력해주세요' }, { status: 400 })

  const customerId = process.env.NAVER_CUSTOMER_ID
  const accessKey = process.env.NAVER_ACCESS_LICENSE
  const secretKey = process.env.NAVER_SECRET_KEY

  // 전체 키워드 + 각 단어별로 쪼개서 검색 (최대 3개)
  const words = product.trim().split(/\s+/).filter(w => w.length >= 2)
  const searchTerms = [product, ...words].slice(0, 3)

  // 동시에 여러 키워드 검색
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

  // 검색량 기준 정렬
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

  return NextResponse.json({ keywords: naverKeywords, naverShopping, coupang })
}
