import { NextResponse } from 'next/server'
import crypto from 'crypto'

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

function isRelevant(keyword, productWords) {
  return productWords.some(word => word.length >= 2 && keyword.includes(word))
}

export async function POST(req) {
  const { product } = await req.json()
  if (!product) return NextResponse.json({ error: '상품명을 입력해주세요' }, { status: 400 })

  const productWords = product.trim().split(/\s+/)
  const customerId = process.env.NAVER_CUSTOMER_ID
  const accessKey = process.env.NAVER_ACCESS_LICENSE
  const secretKey = process.env.NAVER_SECRET_KEY

  const timestamp = Date.now().toString()
  const signature = makeSignature(timestamp, 'GET', '/keywordstool', secretKey)

  const [naverResp, shoppingResp, coupangResp] = await Promise.allSettled([
    fetch(`https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(product)}&showDetail=1`, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': accessKey,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
    }),
    fetch(`https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(product)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://shopping.naver.com' },
    }),
    fetch(`https://www.coupang.com/np/search/autoComplete?keyword=${encodeURIComponent(product)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.coupang.com' },
    }),
  ])

  let naverKeywords = { high: [], mid: [], low: [], niche: [] }
  try {
    if (naverResp.status === 'fulfilled' && naverResp.value.ok) {
      const data = await naverResp.value.json()
      const list = data.keywordList || []
      const total = (k) => k.pc + k.mobile
      const sorted = list
        .map(k => ({
          keyword: k.relKeyword,
          pc: k.monthlyPcQcCnt === '< 10' ? 5 : Number(k.monthlyPcQcCnt) || 0,
          mobile: k.monthlyMobileQcCnt === '< 10' ? 5 : Number(k.monthlyMobileQcCnt) || 0,
          competition: k.compIdx,
        }))
        .filter(k => isRelevant(k.keyword, productWords))
        .sort((a, b) => total(b) - total(a))
        .slice(0, 20)
      naverKeywords = {
        high:  sorted.filter(k => total(k) >= 10000),
        mid:   sorted.filter(k => total(k) >= 1000 && total(k) < 10000),
        low:   sorted.filter(k => total(k) >= 100  && total(k) < 1000),
        niche: sorted.filter(k => total(k) < 100),
      }
    }
  } catch (e) { console.error('Naver error:', e) }

  let naverShopping = []
  try {
    if (shoppingResp.status === 'fulfilled' && shoppingResp.value.ok) {
      const data = await shoppingResp.value.json()
      const items = data.items?.[0] || []
      naverShopping = items
        .map(item => Array.isArray(item) ? item[0] : item)
        .filter(s => s && typeof s === 'string')
        .slice(0, 10)
    }
  } catch (e) { console.error('Naver shopping error:', e) }

  let coupang = []
  try {
    if (coupangResp.status === 'fulfilled' && coupangResp.value.ok) {
      const text = await coupangResp.value.text()
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
