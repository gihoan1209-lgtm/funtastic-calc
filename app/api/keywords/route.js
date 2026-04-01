import { NextResponse } from 'next/server'
import crypto from 'crypto'

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

// 상품명 단어 중 하나라도 키워드에 포함되어 있는지 확인
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
  const method = 'GET'
  const path = '/keywordstool'
  const signature = makeSignature(timestamp, method, path, secretKey)

  // 네이버 + 쿠팡 동시 호출
  const [naverResp, coupangResp] = await Promise.allSettled([
    fetch(`https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(product)}&showDetail=1`, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': accessKey,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
    }),
    fetch(`https://www.coupang.com/np/search/autoComplete?keyword=${encodeURIComponent(product)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.coupang.com',
      },
    }),
  ])

  // 네이버 키워드 처리
  let naverKeywords = { high: [], mid: [], low: [], niche: [] }
  try {
    if (naverResp.status === 'fulfilled') {
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
        .slice(0, 20) // 상위 20개만

      naverKeywords = {
        high:  sorted.filter(k => total(k) >= 10000),
        mid:   sorted.filter(k => total(k) >= 1000 && total(k) < 10000),
        low:   sorted.filter(k => total(k) >= 100  && total(k) < 1000),
        niche: sorted.filter(k => total(k) < 100),
      }
    }
  } catch (e) { console.error('Naver error:', e) }

  // 쿠팡 자동완성 처리
  let coupang = []
  try {
    if (coupangResp.status === 'fulfilled') {
      const text = await coupangResp.value.text()
      const json = JSON.parse(text)
      // 쿠팡 응답 형식: { suggests: [{value: '...'}] } 또는 배열
      const suggests = json.suggests || json.data || json || []
      coupang = suggests
        .map(s => typeof s === 'string' ? s : s.value || s.keyword || s.text || '')
        .filter(s => s && isRelevant(s, productWords))
        .slice(0, 20)
    }
  } catch (e) { console.error('Coupang error:', e) }

  return NextResponse.json({ keywords: naverKeywords, coupang })
}
