import { NextResponse } from 'next/server'
import crypto from 'crypto'

function makeSignature(timestamp, method, path, secretKey) {
  const message = `${timestamp}.${method}.${path}`
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64')
}

export async function POST(req) {
  const { product } = await req.json()
  if (!product) return NextResponse.json({ error: '상품명을 입력해주세요' }, { status: 400 })

  const customerId = process.env.NAVER_CUSTOMER_ID
  const accessKey = process.env.NAVER_ACCESS_LICENSE
  const secretKey = process.env.NAVER_SECRET_KEY

  const timestamp = Date.now().toString()
  const method = 'GET'
  const path = '/keywordstool'
  const signature = makeSignature(timestamp, method, path, secretKey)

  try {
    const url = `https://api.naver.com/keywordstool?hintKeywords=${encodeURIComponent(product)}&showDetail=1`
    const resp = await fetch(url, {
      headers: {
        'X-Timestamp': timestamp,
        'X-API-KEY': accessKey,
        'X-Customer': customerId,
        'X-Signature': signature,
      },
    })

    const data = await resp.json()
    const list = data.keywordList || []

    const sorted = list
      .map(k => ({
        keyword: k.relKeyword,
        pc: k.monthlyPcQcCnt === '< 10' ? 5 : Number(k.monthlyPcQcCnt) || 0,
        mobile: k.monthlyMobileQcCnt === '< 10' ? 5 : Number(k.monthlyMobileQcCnt) || 0,
        competition: k.compIdx,
      }))
      .sort((a, b) => (b.pc + b.mobile) - (a.pc + a.mobile))

    const total = (k) => k.pc + k.mobile

    const keywords = {
      high:  sorted.filter(k => total(k) >= 10000),
      mid:   sorted.filter(k => total(k) >= 1000 && total(k) < 10000),
      low:   sorted.filter(k => total(k) >= 100  && total(k) < 1000),
      niche: sorted.filter(k => total(k) < 100),
    }

    return NextResponse.json({ keywords })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '키워드 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
