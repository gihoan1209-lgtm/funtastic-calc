import { NextResponse } from 'next/server'

export async function POST(req) {
  const { product } = await req.json()
  if (!product) return NextResponse.json({ error: '상품명을 입력해주세요' }, { status: 400 })

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: '당신은 한국 이커머스 키워드 전문가입니다. 네이버 스마트스토어, 쿠팡, 지마켓 등에서 실제 소비자들이 검색하는 키워드를 잘 알고 있습니다. 반드시 JSON만 출력하세요. 마크다운 코드블록 없이 순수 JSON만.',
        messages: [{
          role: 'user',
          content: `상품명: "${product}"\n\n이 상품에 대해 한국 이커머스(네이버, 쿠팡)에서 사용되는 키워드를 JSON으로 출력하세요.\n\n형식:\n{\n  "메인키워드": ["키워드1", ...],\n  "세부키워드": ["키워드1", ...],\n  "연관키워드": ["키워드1", ...],\n  "해시태그": ["#태그1", ...],\n  "롱테일키워드": ["키워드1", ...]\n}\n\n각 카테고리마다 8~12개씩. 실제 검색량 높은 키워드 위주로. 한국어로만.`,
        }],
      }),
    })

    const data = await resp.json()
    const text = data.content?.map(c => c.text || '').join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const keywords = JSON.parse(clean)

    return NextResponse.json({ keywords })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: '키워드 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
