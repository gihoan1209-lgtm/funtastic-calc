'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

/* ── helpers ── */
const roundup10 = (n) => Math.ceil(n / 10) * 10
const won = (n) => Math.round(n).toLocaleString('ko-KR') + '원'
const pct = (n) => (n * 100).toFixed(1) + '%'

function calcPrices(cost, b2bOverride, b2cOverride) {
  if (!cost || cost <= 0) return null
  const b2bCalc = cost * 1.4
  const b2bFinal = b2bOverride > 0 ? b2bOverride : roundup10(b2bCalc * 1.1)
  const b2bVat = b2bFinal / 11
  const b2bFee = b2bFinal * 0.1
  const b2bProfit = b2bFinal - cost - b2bVat - b2bFee
  const b2bPct = b2bProfit / b2bFinal

  const b2cCalc = b2bFinal * 1.2
  const b2cFinal = b2cOverride > 0 ? b2cOverride : roundup10(b2cCalc * 1.1)
  const b2cVat = b2cFinal / 11
  const b2cFee = b2cFinal * 0.25
  const b2cProfit = b2cFinal - cost - b2cVat - b2cFee
  const b2cPct = b2cProfit / b2cFinal

  return {
    b2bCalc, b2bFinal, b2bVat, b2bFee, b2bProfit, b2bPct,
    b2cCalc, b2cFinal, b2cVat, b2cFee, b2cProfit, b2cPct,
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

  // keyword state
  const [kwProduct, setKwProduct] = useState('')
  const [kwResult, setKwResult] = useState(null)
  const [coupang, setCoupang] = useState([])
  const [naverShopping, setNaverShopping] = useState([])
  const [kwLoading, setKwLoading] = useState(false)
  const [kwError, setKwError] = useState('')

  // product list state
  const [products, setProducts] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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
    parseFloat(b2cOverride)
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
  const copyKw = (kw) => {
    navigator.clipboard.writeText(kw).catch(() => {})
    setCopiedKw(kw)
    setTimeout(() => setCopiedKw(''), 1200)
  }

  return (
    <>
      <header className="header">
        <div className="header-logo">
          펀타스틱 B2B <span>판매가 계산기 + 키워드 조회</span>
        </div>
      </header>

      <div className="container">
        <div className="tabs">
          {[['calc','판매가 계산기'],['kw','키워드 조회'],['history','상품 목록']].map(([id, label]) => (
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
                    <div className="card-title blue">B2B (도매) · 수수료 10%</div>
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
                    <CalcRow label="수수료 (10%)" value={won(result.b2bFee)} />
                    <CalcRow label="B2B 순이익" value={won(result.b2bProfit)} isProfit color={result.b2bProfit >= 0 ? 'green' : 'red'} />
                    <CalcRow label="순이익률" value={pct(result.b2bPct)} color={result.b2bPct >= 0.15 ? 'green' : 'red'} />
                  </div>

                  {/* B2C */}
                  <div className="card">
                    <div className="card-title teal">B2C (소매) · 수수료 25%</div>
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
                    <CalcRow label="수수료 (25%)" value={won(result.b2cFee)} />
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
                상품명을 입력하면 네이버·쿠팡 스타일 키워드를 AI가 분석해드립니다
              </div>
            )}

            {kwResult && (
              <>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="section-head">{kwProduct} 키워드 분석 결과</div>
                  <span style={{ fontSize: '11px', color: 'var(--text3)' }}>클릭하면 복사됩니다</span>
                </div>

                {/* 연관 검색어 — 맨 위 */}
                {(naverShopping.length > 0 || coupang.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: naverShopping.length > 0 && coupang.length > 0 ? '1fr 1fr' : '1fr', gap: '10px', marginBottom: '10px' }}>
                    {naverShopping.length > 0 && (
                      <div className="kw-card">
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                          <div className="kw-cat" style={{ color: '#1a7a3c', marginBottom: 0 }}>🛍 네이버쇼핑 연관검색어</div>
                        </div>
                        <div className="kw-pills">
                          {naverShopping.map((kw) => (
                            <button key={kw} className={`kw-pill${copiedKw === kw ? ' copied' : ''}`} onClick={() => copyKw(kw)}>
                              {copiedKw === kw ? '복사됨!' : kw}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {coupang.length > 0 && (
                      <div className="kw-card">
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
                          <div className="kw-cat" style={{ color: '#e6600a', marginBottom: 0 }}>🛒 쿠팡 연관검색어</div>
                        </div>
                        <div className="kw-pills">
                          {coupang.map((kw) => (
                            <button key={kw} className={`kw-pill${copiedKw === kw ? ' copied' : ''}`} onClick={() => copyKw(kw)}>
                              {copiedKw === kw ? '복사됨!' : kw}
                            </button>
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
                            <div key={k.keyword} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 7px', borderRadius: '6px', background: 'var(--surface2)' }}>
                              <button className={`kw-pill${copiedKw === k.keyword ? ' copied' : ''}`} style={{ flex: 1, textAlign: 'left', fontSize: '12px' }} onClick={() => copyKw(k.keyword)}>
                                {copiedKw === k.keyword ? '복사됨!' : k.keyword}
                              </button>
                              <span style={{ fontSize: '10px', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                                {(k.pc + k.mobile).toLocaleString()}
                              </span>
                              <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '20px', whiteSpace: 'nowrap', background: k.competition === 'low' ? 'var(--teal-bg)' : k.competition === 'mid' ? 'var(--amber-bg)' : 'var(--red-bg)', color: k.competition === 'low' ? 'var(--teal)' : k.competition === 'mid' ? 'var(--amber)' : 'var(--red)' }}>
                                {k.competition === 'low' ? '낮음' : k.competition === 'mid' ? '중간' : '높음'}
                              </span>
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
