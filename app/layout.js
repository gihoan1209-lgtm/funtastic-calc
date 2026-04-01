import './globals.css'

export const metadata = {
  title: '펀타스틱 판매가 계산기',
  description: 'B2B/B2C 판매가 계산 + 키워드 조회',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
