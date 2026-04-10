'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

/* ── helpers ── */
const roundup10 = (n) => Math.ceil(n / 10) * 10
const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원'
const pct = (n) => (n * 100).toFixed(1) + '%'

function calcPrices(cost, b2bOverride, b2cOverride, b2bRate, b2cRate) {
  if (!cost || cost <= 0) return null
  const b2bR = (parseFloat(b2bRate) || 10) / 100
  const b2cR = (parseFloat(b2cRate) || 25) / 100
  const b2bCalc = cost * 1.4
  const b2bFinal = b2bOverride > 0 ? b2bOverride : roundup10(b2bCalc * 1.1)
  const b2bVat = b2bFinal / 11
  const b2bFee = b2bFinal * b2bR
  const b2bProfit = b2bFinal - cost - b2bVat - b2bFee
  const b2bPct = b2bProfit / b2bFinal

  const b2cCalc = b2bFinal * 1.2
  const b2cFinal = b2cOverride > 0 ? b2cOverride : roundup10(b2cCalc * 1.1)
  const b2cVat = b2cFinal / 11
  const b2cFee = b2cFinal * b2cR
  const b2cProfit = b2cFinal - cost - b2cVat - b2cFee
  const b2cPct = b2cProfit / b2cFinal

  return {
    b2bCalc, b2bFinal, b2bVat, b2bFee, b2bProfit, b2bPct,
    b2cCalc, b2cFinal, b2cVat, b2cFee, b2cProfit, b2cPct,
    b2bR, b2cR,
  }
}

/* ── sub components ── */
function CalcRow({ label, value, isProfit, color }) {
  return (
    <div className={`calc-row${isProfit ? ' profit-row' : ''}`}>
      <span className="calc-row-label">{label}</span>
      <span className={`calc-row-val${color ? ` ${color}` : ''}`}>{value}</span>
    </div>
  )
}

function MetricCard({ label, value, color }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-val${color ? ` ${color}` : ''}`}>{value}</div>
    </div>
  )
}

function Toast({ msg }) {
  return <div className={`toast${msg ? ' show' : ''}`}>{msg}</div>
}

/* ── main app ── */
export default function App() {
  const [tab, setTab] = useState('calc')

  // calculator state
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [b2bOverride, setB2bOverride] = useState('')
  const [b2cOverride, setB2cOverride] = useState('')
  const [b2bRate, setB2bRate] = useState('10')
  const [b2cRate, setB2cRate] = useState('25')

  // keyword state
  const [kwProduct, setKwProduct] = useState('')
  const [kwResult, setKwResult] = useState(null)
  const [coupang, setCoupang] = useState([])
  const [naverShopping, setNaverShopping] = useState([])
  const [aiRecommended, setAiRecommended] = useState([])
  const [kwLoading, setKwLoading] = useState(false)
  const [kwError, setKwError] = useState('')

  // product list state
  const [products, setProducts] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // cost calculator state
  const [costProducts, setCostProducts] = useState([{ id: 1, name: '', price: '', qty: '', shipTotal: '', width: '', depth: '', height: '' }])
  const [costExRate, setCostExRate] = useState('220')
  const [costCbmRate, setCostCbmRate] = useState('127000')
  let costNextId = useRef(2)

  const addCostProduct = () => {
    setCostProducts(prev => [...prev, { id: costNextId.current++, name: '', price: '', qty: '', shipTotal: '', width: '', depth: '', height: '' }])
  }
  const removeCostProduct = (id) => {
    setCostProducts(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev)
  }
  const updateCostProduct = (id, field, value) => {
    setCostProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }
  const calcCostProduct = (p) => {
    const rate = parseFloat(costExRate) || 220
    const cbmRate = parseFloat(costCbmRate) || 127000
    const price = parseFloat(p.price) || 0
    const qty = parseFloat(p.qty) || 0
    const shipTotal = parseFloat(p.shipTotal) || 0
    const w = parseFloat(p.width) || 0
    const d = parseFloat(p.depth) || 0
    const h = parseFloat(p.height) || 0
    const cnShipPerUnit = qty > 0 ? shipTotal / qty : 0
    const cbm = (w / 100) * (d / 100) * (h / 100)
    const cnCostKRW = price * rate
    const cnShipKRW = cnShipPerUnit * rate
    const krShipPerUnit = cbm * cbmRate
    const unitCost = cnCostKRW + cnShipKRW + krShipPerUnit
    return { cnShipPerUnit, cbm, cnCostKRW, cnShipKRW, krShipPerUnit, unitCost, qty }
  }

  // toast
  const [toast, setToast] = useState('')
  const toastTimer = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }

  const result = calcPrices(
    parseFloat(cost),
    parseFloat(b2bOverride),
    parseFloat(b2cOverride),
    b2bRate,
    b2cRate,
  )

  /* fetch product list */
  const fetchProducts = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data.products || [])
    } catch { /* ignore */ }
    setListLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'history') fetchProducts()
  }, [tab, fetchProducts])

  /* save product */
  const saveProduct = async () => {
    if (!result || !name.trim()) { showToast('상품명을 입력해주세요'); return }
    setSaving(true)
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        cost: parseFloat(cost),
        b2b_price: result.b2bFinal,
        b2c_price: result.b2cFinal,
        b2b_margin: result.b2bPct,
        b2c_margin: result.b2cPct,
      }),
    })
    setSaving(false)
    showToast(`"${name.trim()}" 저장 완료!`)
  }

  /* delete product */
  const deleteProduct = async (id) => {
    await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchProducts()
  }

  /* load product into calc */
  const loadProduct = (p) => {
    setName(p.name)
    setCost(String(p.cost))
    setB2bOverride(String(p.b2b_price))
    setB2cOverride(String(p.b2c_price))
    setTab('calc')
  }

  /* keyword fetch */
  const fetchKeywords = async () => {
    if (!kwProduct.trim()) return
    setKwLoading(true)
    setKwResult(null)
    setCoupang([])
    setNaverShopping([])
    setAiRecommended([])
    setKwError('')
    try {
      const res = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: kwProduct }),
      })
      const data = await res.json()
      if (data.error) { setKwError(data.error); return }
      setKwResult(data.keywords)
      setCoupang(data.coupang || [])
      setNaverShopping(data.naverShopping || [])
      setAiRecommended(data.aiRecommended || [])
    } catch {
      setKwError('오류가 발생했습니다. 다시 시도해주세요.')
    }
    setKwLoading(false)
  }

  /* go to keyword tab with current product name */
  const goToKw = () => {
    setKwProduct(name)
    setTab('kw')
    if (name) setTimeout(fetchKeywords, 100)
  }

  const [copiedKw, setCopiedKw] = useState('')
  const [expandedKw, setExpandedKw] = useState('')
  const copyKw = (kw) => {
    navigator.clipboard.writeText(kw).catch(() => {})
    setCopiedKw(kw)
    setTimeout(() => setCopiedKw(''), 1200)
  }
  const toggleKw = (kw) => setExpandedKw(prev => prev === kw ? '' : kw)

  return (
    <>
      <header className="header">
        <div className="header-logo">
          펀타스틱 B2B <span>판매가 계산기 + 원가 계산기 + 키워드 조회</span>
        </div>
      </header>

      <div className="container">
        <div className="tabs">
          {[['calc','판매가 계산기'],['costcalc','원가 계산기'],['kw','키워드 조회'],['history','상품 목록']].map(([id, label]) => (
            <button key={id} className={`tab${tab===id?' active':''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {/* ── CALCULATOR TAB ── */}
        {tab === 'calc' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">상품명</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: 프루어 미니 우양산" />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label className="label">원가 (₩)</label>
                <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="중국 사입 원가" min="0" />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center' }} onClick={saveProduct} disabled={!result || saving}>
                  {saving ? <span className="spinner" /> : '저장'}
                </button>
              </div>
            </div>

            {!result && (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
                원가를 입력하면 B2B / B2C 판매가가 자동으로 계산됩니다
              </div>
            )}

            {result && (
              <>
                <div className="metrics">
                  <MetricCard label="B2B 확정가" value={won(result.b2bFinal)} />
                  <MetricCard label="B2C 확정가" value={won(result.b2cFinal)} />
                  <MetricCard label="B2B 순이익률" value={pct(result.b2bPct)} color={result.b2bPct >= 0.15 ? 'green' : 'red'} />
                  <MetricCard label="B2C 순이익률" value={pct(result.b2cPct)} color={result.b2cPct >= 0.15 ? 'green' : 'red'} />
                </div>

                <div className="calc-grid">
                  {/* B2B */}
                  <div className="card">
                    <div className="card-title blue">B2B (도매)</div>
                    <CalcRow label="계산가 (원가 × 1.4)" value={won(result.b2bCalc)} />
                    <div className="calc-row">
                      <span className="calc-row-label">확정가</span>
                      <div className="override-field">
                        <input type="number" value={b2bOverride} onChange={e => setB2bOverride(e.target.value)} placeholder={won(result.b2bFinal)} />
                        {b2bOverride && <button onClick={() => setB2bOverride('')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>}
                        {!b2bOverride && <span className="override-hint">비우면 자동</span>}
                      </div>
                    </div>
                    <CalcRow label="매출 부가세 (÷ 11)" value={won(result.b2bVat)} />
                    <div className="calc-row">
                      <span className="calc-row-label">수수료</span>
                      <div className="override-field">
                        <input type="number" value={b2bRate === '10' ? '' : b2bRate} onChange={e => setB2bRate(e.target.value || '10')} placeholder="10%" min="0" max="100" />
                        {b2bRate !== '10' && <button onClick={() => setB2bRate('10')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>}
                        {b2bRate === '10' && <span className="override-hint">비우면 10%</span>}
                      </div>
                    </div>
                    <CalcRow label="B2B 순이익" value={won(result.b2bProfit)} isProfit color={result.b2bProfit >= 0 ? 'green' : 'red'} />
                    <CalcRow label="순이익률" value={pct(result.b2bPct)} color={result.b2bPct >= 0.15 ? 'green' : 'red'} />
                  </div>

                  {/* B2C */}
                  <div className="card">
                    <div className="card-title teal">B2C (소매)</div>
                    <CalcRow label="계산가 (B2B확정가 × 1.2)" value={won(result.b2cCalc)} />
                    <div className="calc-row">
                      <span className="calc-row-label">확정가</span>
                      <div className="override-field">
                        <input type="number" value={b2cOverride} onChange={e => setB2cOverride(e.target.value)} placeholder={won(result.b2cFinal)} />
                        {b2cOverride && <button onClick={() => setB2cOverride('')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>}
                        {!b2cOverride && <span className="override-hint">비우면 자동</span>}
                      </div>
                    </div>
                    <CalcRow label="매출 부가세 (÷ 11)" value={won(result.b2cVat)} />
                    <div className="calc-row">
                      <span className="calc-row-label">수수료</span>
                      <div className="override-field">
                        <input type="number" value={b2cRate === '25' ? '' : b2cRate} onChange={e => setB2cRate(e.target.value || '25')} placeholder="25%" min="0" max="100" />
                        {b2cRate !== '25' && <button onClick={() => setB2cRate('25')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>초기화</button>}
                        {b2cRate === '25' && <span className="override-hint">비우면 25%</span>}
                      </div>
                    </div>
                    <CalcRow label="B2C 순이익" value={won(result.b2cProfit)} isProfit color={result.b2cProfit >= 0 ? 'green' : 'red'} />
                    <CalcRow label="순이익률" value={pct(result.b2cPct)} color={result.b2cPct >= 0.15 ? 'green' : 'red'} />
                  </div>
                </div>

                <div className="action-bar">
                  <button className="btn" onClick={goToKw}>이 상품 키워드 조회 →</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── KEYWORD TAB ── */}
        {tab === 'kw' && (
          <div>
            <div className="toolbar">
              <input
                type="text"
                value={kwProduct}
                onChange={e => setKwProduct(e.target.value)}
                placeholder="상품명 입력 (예: 압축 파우치, 우양산, 키링...)"
                onKeyDown={e => e.key === 'Enter' && fetchKeywords()}
              />
              <button className="btn btn-dark" onClick={fetchKeywords} disabled={kwLoading || !kwProduct.trim()}>
                {kwLoading ? <><span className="spinner" /> 조회 중...</> : '키워드 조회'}
              </button>
            </div>

            {kwError && <div className="status-text" style={{ color: 'var(--red)' }}>{kwError}</div>}
            {!kwResult && !kwLoading && !kwError && (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
                상품명을 입력하면 네이버·쿠팡 키워드와 판매링크를 바로 확인할 수 있어요
              </div>
            )}

            {kwResult && (
              <>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="section-head">{kwProduct} 키워드 분석 결과</div>
                  <span style={{ fontSize: '11px', color: 'var(--text3)' }}>키워드 클릭 → 판매링크 확인</span>
                </div>

                {/* ✨ AI 추천 키워드 — 맨 위 */}
                {aiRecommended.length > 0 && (
                  <div className="kw-card" style={{ marginBottom: '10px', border: '1.5px solid #c8b4f0', background: '#f8f4ff' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                      <div className="kw-cat" style={{ color: '#6b3fa0', marginBottom: 0 }}>✨ AI 추천 키워드</div>
                      <span style={{ fontSize: '11px', color: 'var(--text3)' }}>연관성 높은 상위 20개</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {aiRecommended.map((k) => (
                        <div key={k.keyword}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 7px', borderRadius: '6px', background: expandedKw === k.keyword ? '#ede4ff' : '#ede4ff80', cursor: 'pointer' }} onClick={() => toggleKw(k.keyword)}>
                            <span style={{ flex: 1, fontSize: '13px', color: '#3d1f7a', fontWeight: 500 }}>{k.keyword}</span>
                            <span style={{ fontSize: '10px', color: '#6b3fa0', whiteSpace: 'nowrap' }}>{(k.pc + k.mobile).toLocaleString()}</span>
                            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '20px', whiteSpace: 'nowrap', background: k.competition === 'low' ? 'var(--teal-bg)' : k.competition === 'mid' ? 'var(--amber-bg)' : 'var(--red-bg)', color: k.competition === 'low' ? 'var(--teal)' : k.competition === 'mid' ? 'var(--amber)' : 'var(--red)' }}>
                              {k.competition === 'low' ? '낮음' : k.competition === 'mid' ? '중간' : '높음'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#6b3fa0' }}>{expandedKw === k.keyword ? '▲' : '▼'}</span>
                          </div>
                          {expandedKw === k.keyword && (
                            <div style={{ display: 'flex', gap: '4px', padding: '6px 7px', background: '#ede4ff', borderRadius: '0 0 6px 6px', flexWrap: 'wrap' }}>
                              <button onClick={() => copyKw(k.keyword)} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #c8b4f0', borderRadius: '4px', background: copiedKw === k.keyword ? 'var(--teal-bg)' : '#fff', color: copiedKw === k.keyword ? 'var(--teal)' : '#3d1f7a', cursor: 'pointer' }}>
                                {copiedKw === k.keyword ? '✓ 복사됨!' : '📋 복사'}
                              </button>
                              <a href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(k.keyword)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #c8b4f0', borderRadius: '4px', background: '#fff', color: '#3d1f7a', textDecoration: 'none' }}>🛍 네이버쇼핑 →</a>
                              <a href={`https://www.coupang.com/np/search?q=${encodeURIComponent(k.keyword)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #c8b4f0', borderRadius: '4px', background: '#fff', color: '#3d1f7a', textDecoration: 'none' }}>🛒 쿠팡 →</a>
                              <a href={`https://smartstore.naver.com/main/search?searchKeyword=${encodeURIComponent(k.keyword)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #c8b4f0', borderRadius: '4px', background: '#fff', color: '#3d1f7a', textDecoration: 'none' }}>🏪 스마트스토어 →</a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 🔥 트렌드 바로가기 */}
                <div className="kw-card" style={{ marginBottom: '10px', background: 'var(--amber-bg)' }}>
                  <div className="kw-cat" style={{ color: '#92570a', marginBottom: '8px' }}>🔥 지금 핫한 트렌드 확인</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {[
                      { label: '네이버 쇼핑 트렌드', url: `https://datalab.naver.com/shoppingInsight/sCategory.naver` },
                      { label: `"${kwProduct}" 네이버 트렌드`, url: `https://datalab.naver.com/keyword/trendResult.naver?hashKey=&startDate=2024-01-01&endDate=2025-04-01&timeUnit=month&keyword=${encodeURIComponent(kwProduct)}&gender=&age=&device=` },
                      { label: `"${kwProduct}" 구글 트렌드`, url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(kwProduct)}&geo=KR` },
                      { label: '쿠팡 베스트', url: `https://www.coupang.com/np/campaigns/82` },
                    ].map(({ label, url }) => (
                      <a key={label} href={url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', border: '1px solid #e8c97a', background: '#fff8e7', color: '#92570a', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        {label} →
                      </a>
                    ))}
                  </div>
                </div>

                {/* 연관 검색어 — 맨 위 */}
                {(naverShopping.length > 0 || coupang.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: naverShopping.length > 0 && coupang.length > 0 ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '10px' }}>
                    {naverShopping.length > 0 && (
                      <div className="kw-card">
                        <div className="kw-cat" style={{ color: '#1a7a3c', marginBottom: '10px' }}>🛍 네이버쇼핑 연관검색어</div>
                        <div className="kw-pills">
                          {naverShopping.map((kw) => (
                            <div key={kw} style={{ display: 'inline-block' }}>
                              <button className={`kw-pill${expandedKw === kw ? ' copied' : ''}`} onClick={() => toggleKw(kw)}>
                                {kw} {expandedKw === kw ? '▲' : '▼'}
                              </button>
                              {expandedKw === kw && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', marginBottom: '4px', padding: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', minWidth: '180px' }}>
                                  <button onClick={() => copyKw(kw)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: copiedKw === kw ? 'var(--teal-bg)' : 'var(--surface2)', color: copiedKw === kw ? 'var(--teal)' : 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                                    {copiedKw === kw ? '✓ 복사됨!' : '📋 키워드 복사'}
                                  </button>
                                  <a href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(kw)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--text)', textDecoration: 'none', display: 'block' }}>🛍 네이버쇼핑 판매링크 →</a>
                                  <a href={`https://www.coupang.com/np/search?q=${encodeURIComponent(kw)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--text)', textDecoration: 'none', display: 'block' }}>🛒 쿠팡 판매링크 →</a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {coupang.length > 0 && (
                      <div className="kw-card">
                        <div className="kw-cat" style={{ color: '#e6600a', marginBottom: '10px' }}>🛒 쿠팡 연관검색어</div>
                        <div className="kw-pills">
                          {coupang.map((kw) => (
                            <div key={kw} style={{ display: 'inline-block' }}>
                              <button className={`kw-pill${expandedKw === kw ? ' copied' : ''}`} onClick={() => toggleKw(kw)}>
                                {kw} {expandedKw === kw ? '▲' : '▼'}
                              </button>
                              {expandedKw === kw && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', marginBottom: '4px', padding: '8px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', minWidth: '180px' }}>
                                  <button onClick={() => copyKw(kw)} style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: copiedKw === kw ? 'var(--teal-bg)' : 'var(--surface2)', color: copiedKw === kw ? 'var(--teal)' : 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                                    {copiedKw === kw ? '✓ 복사됨!' : '📋 키워드 복사'}
                                  </button>
                                  <a href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(kw)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--text)', textDecoration: 'none', display: 'block' }}>🛍 네이버쇼핑 판매링크 →</a>
                                  <a href={`https://www.coupang.com/np/search?q=${encodeURIComponent(kw)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface2)', color: 'var(--text)', textDecoration: 'none', display: 'block' }}>🛒 쿠팡 판매링크 →</a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 네이버 키워드도구 — 2열 그리드 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { key: 'high',  label: '🔥 인기 키워드',   sub: '월 검색 1만+', color: '#b02a2a' },
                    { key: 'mid',   label: '📈 중간 키워드',   sub: '월 검색 1천~1만', color: '#92570a' },
                    { key: 'low',   label: '🎯 틈새 키워드',   sub: '월 검색 100~1천', color: '#0d6b52' },
                    { key: 'niche', label: '💎 롱테일 키워드', sub: '월 검색 100 미만', color: '#1a4f8a' },
                  ].map(({ key, label, sub, color }) => (
                    kwResult[key]?.length > 0 && (
                      <div key={key} className="kw-card">
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                          <div className="kw-cat" style={{ color, marginBottom: 0 }}>{label}</div>
                          <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{sub}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {kwResult[key].map((k) => (
                            <div key={k.keyword}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 7px', borderRadius: '6px', background: expandedKw === k.keyword ? 'var(--blue-bg)' : 'var(--surface2)', cursor: 'pointer' }} onClick={() => toggleKw(k.keyword)}>
                                <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)', fontWeight: expandedKw === k.keyword ? 500 : 400 }}>{k.keyword}</span>
                                <span style={{ fontSize: '10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>{(k.pc + k.mobile).toLocaleString()}</span>
                                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '20px', whiteSpace: 'nowrap', background: k.competition === 'low' ? 'var(--teal-bg)' : k.competition === 'mid' ? 'var(--amber-bg)' : 'var(--red-bg)', color: k.competition === 'low' ? 'var(--teal)' : k.competition === 'mid' ? 'var(--amber)' : 'var(--red)' }}>
                                  {k.competition === 'low' ? '낮음' : k.competition === 'mid' ? '중간' : '높음'}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text3)' }}>{expandedKw === k.keyword ? '▲' : '▼'}</span>
                              </div>
                              {expandedKw === k.keyword && (
                                <div style={{ display: 'flex', gap: '4px', padding: '6px 7px', background: 'var(--blue-bg)', borderRadius: '0 0 6px 6px', flexWrap: 'wrap' }}>
                                  <button onClick={() => copyKw(k.keyword)} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--border-info)', borderRadius: '4px', background: copiedKw === k.keyword ? 'var(--teal-bg)' : 'var(--surface)', color: copiedKw === k.keyword ? 'var(--teal)' : 'var(--text)', cursor: 'pointer' }}>
                                    {copiedKw === k.keyword ? '✓ 복사됨!' : '📋 복사'}
                                  </button>
                                  <a href={`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(k.keyword)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none' }}>🛍 네이버쇼핑 →</a>
                                  <a href={`https://www.coupang.com/np/search?q=${encodeURIComponent(k.keyword)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none' }}>🛒 쿠팡 →</a>
                                  <a href={`https://smartstore.naver.com/main/search?searchKeyword=${encodeURIComponent(k.keyword)}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none' }}>🏪 스마트스토어 →</a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── COST CALCULATOR TAB ── */}
        {tab === 'costcalc' && (
          <div>
            {/* 공통 설정 */}
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <div className="card-title" style={{ color: 'var(--text2)' }}>⚙️ 공통 설정</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="field" style={{ margin: 0 }}>
                  <label className="label">환율 (원/元)</label>
                  <input type="number" value={costExRate} onChange={e => setCostExRate(e.target.value)} />
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label className="label">CBM당 해운단가 (원/CBM)</label>
                  <input type="number" value={costCbmRate} onChange={e => setCostCbmRate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* 상품 카드 목록 */}
            {costProducts.map((p, idx) => {
              const r = calcCostProduct(p)
              return (
                <div key={p.id} className="card" style={{ marginBottom: '12px', position: 'relative' }}>
                  {/* 번호 + 삭제 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span className="badge badge-blue" style={{ fontSize: '12px', fontWeight: 700 }}>{idx + 1}</span>
                    {costProducts.length > 1 && (
                      <button className="btn btn-sm" style={{ color: 'var(--text3)', borderColor: 'transparent', padding: '2px 8px' }} onClick={() => removeCostProduct(p.id)}>✕</button>
                    )}
                  </div>

                  {/* 상품명 */}
                  <input type="text" value={p.name} onChange={e => updateCostProduct(p.id, 'name', e.target.value)} placeholder="상품명 입력" style={{ marginBottom: '12px', fontWeight: 600 }} />

                  {/* 입력 행 1: 중국단가, 수량, 총배송비 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">중국단가 (元)</label>
                      <input type="number" step="0.1" value={p.price} onChange={e => updateCostProduct(p.id, 'price', e.target.value)} placeholder="0" />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">수량 (개)</label>
                      <input type="number" value={p.qty} onChange={e => updateCostProduct(p.id, 'qty', e.target.value)} placeholder="0" />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">총배송비 (元)</label>
                      <input type="number" step="0.1" value={p.shipTotal} onChange={e => updateCostProduct(p.id, 'shipTotal', e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  {/* 입력 행 2: 가로, 세로, 높이 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">가로 (cm)</label>
                      <input type="number" step="0.1" value={p.width} onChange={e => updateCostProduct(p.id, 'width', e.target.value)} placeholder="0" />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">세로 (cm)</label>
                      <input type="number" step="0.1" value={p.depth} onChange={e => updateCostProduct(p.id, 'depth', e.target.value)} placeholder="0" />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label className="label">높이 (cm)</label>
                      <input type="number" step="0.1" value={p.height} onChange={e => updateCostProduct(p.id, 'height', e.target.value)} placeholder="0" />
                    </div>
                  </div>

                  {/* 결과 */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px' }}>중국원가 (원화)</div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{r.cnCostKRW > 0 ? won(r.cnCostKRW) : '-'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px' }}>개당배송비 (元)</div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{r.cnShipPerUnit > 0 ? r.cnShipPerUnit.toFixed(2) + '元' : '-'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px' }}>개당배송비 (원화)</div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{r.cnShipKRW > 0 ? won(r.cnShipKRW) : '-'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '4px' }}>개당원가 (원화)</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--blue)' }}>{r.unitCost > 0 ? won(r.unitCost) : '-'}</div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* 상품 추가 버튼 */}
            <button className="btn" style={{ width: '100%', justifyContent: 'center', border: '2px dashed var(--border)', color: 'var(--text3)', marginBottom: '1.25rem' }} onClick={addCostProduct}>
              + 상품 추가
            </button>

            {/* 하단 합계 */}
            {(() => {
              let cnt = 0, total = 0
              costProducts.forEach(p => {
                const r = calcCostProduct(p)
                if (r.unitCost > 0) { cnt++; total += r.unitCost * r.qty }
              })
              return (
                <div style={{ background: 'var(--text)', borderRadius: 'var(--radius)', padding: '1.25rem', color: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '11px', opacity: 0.6 }}>총 상품 수</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{cnt}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', opacity: 0.6 }}>총 원가 합계</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>{total > 0 ? won(total) : '0원'}</div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── PRODUCT LIST TAB ── */}
        {tab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div className="section-head">저장된 상품 ({products.length}개)</div>
              <button className="btn btn-sm" onClick={fetchProducts}>새로고침</button>
            </div>

            {listLoading && <div className="status-text"><span className="spinner" style={{ display: 'block', margin: '0 auto 8px' }} /></div>}

            {!listLoading && products.length === 0 && (
              <div className="card"><div className="empty-text">저장된 상품이 없습니다. 계산기에서 상품을 저장해보세요.</div></div>
            )}

            {!listLoading && products.length > 0 && (
              <div className="card" style={{ padding: '0.5rem 0' }}>
                {products.map((p) => (
                  <div key={p.id} className="product-item" onClick={() => loadProduct(p)}>
                    <div style={{ flex: 1 }}>
                      <div className="product-name">{p.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                        원가 {Math.round(p.cost).toLocaleString('ko-KR')}원
                      </div>
                    </div>
                    <div className="product-badges">
                      <span className="badge badge-blue">B2B {won(p.b2b_price)}</span>
                      <span className="badge badge-teal">B2C {won(p.b2c_price)}</span>
                      <span className="badge" style={{ background: p.b2b_margin >= 0.15 ? 'var(--teal-bg)' : 'var(--red-bg)', color: p.b2b_margin >= 0.15 ? 'var(--teal-text)' : 'var(--red)' }}>
                        {pct(p.b2b_margin)}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--text3)', borderColor: 'transparent' }}
                      onClick={e => { e.stopPropagation(); deleteProduct(p.id) }}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Toast msg={toast} />
    </>
  )
}
