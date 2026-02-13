import { useState, useEffect } from 'react'
import { getTickersLinear, getOrderbook } from '../api/bybit'
import s from './DensityMap.module.css'

type DensityLevel = { price: number; size: number; valueUsd: number; side: 'bid' | 'ask' }

export type VolumeNearPriceRow = {
  symbol: string
  lastPrice: number
  distancePct: number
  volumeAtLevel: number
  levelPrice: number
  densityRatio: number // Соотношение плотности к общему объему 24h
  turnover24h: number // Общий объем 24h
  supportStrength: 'weak' | 'medium' | 'strong' // Сила поддержки/сопротивления
}

const MAX_DISTANCE_PCT_DEFAULT = 2
const TOP_SYMBOLS_BY_VOLUME = 60
const BATCH_SIZE = 4
const MIN_DENSITY_RATIO = 0.15 // Минимальное соотношение плотности к общему объему

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export default function DensityMap() {
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [symbols, setSymbols] = useState<string[]>([])
  const [bids, setBids] = useState<DensityLevel[]>([])
  const [asks, setAsks] = useState<DensityLevel[]>([])
  const [mid, setMid] = useState(0)
  const [loading, setLoading] = useState(true)
  const [volumeNearList, setVolumeNearList] = useState<VolumeNearPriceRow[]>([])
  const [volumeNearLoading, setVolumeNearLoading] = useState(false)
  const [maxDistancePct, setMaxDistancePct] = useState(MAX_DISTANCE_PCT_DEFAULT)
  const [sortBy, setSortBy] = useState<'distance' | 'volume' | 'density' | 'price_change' | 'symbol' | 'price'>('density')
  const [minVolumeUsd, setMinVolumeUsd] = useState(0)

  useEffect(() => {
    getTickersLinear().then((res) => {
      const list = res.list
        .map((t: any) => t.symbol)
        .filter((sym: string) => sym.endsWith('USDT'))
        .sort()
      setSymbols(list)
    })
  }, [])

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    Promise.all([getOrderbook(symbol, 200), getTickersLinear()])
      .then(([ob, tickersRes]) => {
        const ticker = tickersRes.list.find((t: any) => t.symbol === symbol)
        const lastPrice = ticker ? parseFloat(ticker.lastPrice) : (parseFloat(ob.b[0]?.[0] || '0') + parseFloat(ob.a[0]?.[0] || '0')) / 2
        setMid(lastPrice)
        const toLevel = (side: 'bid' | 'ask') => (entry: [string, string]): DensityLevel => {
          const price = parseFloat(entry[0])
          const size = parseFloat(entry[1])
          return { price, size, valueUsd: price * size, side }
        }
        setBids(ob.b.map(toLevel('bid')))
        setAsks(ob.a.map(toLevel('ask')))
      })
      .finally(() => setLoading(false))
  }, [symbol])

  const loadVolumeNearPrice = () => {
    setVolumeNearLoading(true)
    getTickersLinear()
      .then((res) => {
        const byVol = res.list
          .filter((t: any) => t.symbol.endsWith('USDT'))
          .sort((a: any, b: any) => parseFloat(b.turnover24h || 0) - parseFloat(a.turnover24h || 0))
          .slice(0, TOP_SYMBOLS_BY_VOLUME)
          .map((t: any) => t.symbol)
        return byVol
      })
      .then(async (symbolList: string[]) => {
        const tickersRes = await getTickersLinear()
        const lastPrices: Record<string, number> = {}
        const turnover24h: Record<string, number> = {}
        tickersRes.list.forEach((t: any) => {
          lastPrices[t.symbol] = parseFloat(t.lastPrice)
          turnover24h[t.symbol] = parseFloat(t.turnover24h || '0')
        })
        const rows: VolumeNearPriceRow[] = []
        
        for (let i = 0; i < symbolList.length; i += BATCH_SIZE) {
          const batch = symbolList.slice(i, i + BATCH_SIZE)
          const obs = await Promise.all(batch.map((sym) => getOrderbook(sym, 100)))
          await delay(300)
          
          batch.forEach((sym, j) => {
            const ob = obs[j]
            const lastPrice = lastPrices[sym] || 0
            const totalVolume = turnover24h[sym] || 0
            
            if (!lastPrice || totalVolume < 1000000) return // Пропускаем монеты с объемом менее $1M
            
            const toLevel = (entry: [string, string]) => {
              const price = parseFloat(entry[0])
              const size = parseFloat(entry[1])
              return { price, valueUsd: price * size }
            }
            const allLevels = [...(ob.b || []).map(toLevel), ...(ob.a || []).map(toLevel)]
            
            // Ищем уровни с высокой плотностью
            const densityLevels = allLevels.filter(level => {
              const distancePct = (Math.abs(level.price - lastPrice) / lastPrice) * 100
              if (distancePct > 5) return false // Игнорируем уровни дальше 5%
              const densityRatio = totalVolume > 0 ? level.valueUsd / totalVolume : 0
              return densityRatio >= MIN_DENSITY_RATIO
            })
            
            if (densityLevels.length === 0) return
            
            // Находим лучший уровень - максимальную плотность
            const bestLevel = densityLevels.reduce((a, b) => a.valueUsd > b.valueUsd ? a : b)
            const distancePct = (Math.abs(bestLevel.price - lastPrice) / lastPrice) * 100
            
            // Определяем силу поддержки/сопротивления
            let supportStrength: 'weak' | 'medium' | 'strong' = 'weak'
            if (bestLevel.valueUsd / totalVolume >= 0.3 && distancePct <= 1) {
              supportStrength = 'strong'
            } else if (bestLevel.valueUsd / totalVolume >= 0.15 && distancePct <= 2) {
              supportStrength = 'medium'
            }
            
            rows.push({
              symbol: sym,
              lastPrice,
              distancePct,
              volumeAtLevel: bestLevel.valueUsd,
              levelPrice: bestLevel.price,
              densityRatio: bestLevel.valueUsd / totalVolume,
              turnover24h: totalVolume,
              supportStrength
            })
          })
        }
        return rows
      })
      .then((rows) => {
        setVolumeNearList(rows)
        setVolumeNearLoading(false)
      })
      .catch(() => setVolumeNearLoading(false))
  }

  useEffect(() => {
    loadVolumeNearPrice()
  }, [])

  const filteredVolumeNear = volumeNearList
    .filter((r) => r.distancePct <= maxDistancePct && r.volumeAtLevel >= minVolumeUsd)
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distancePct - b.distancePct
      if (sortBy === 'volume') return b.volumeAtLevel - a.volumeAtLevel
      if (sortBy === 'density') return b.densityRatio - a.densityRatio
      if (sortBy === 'price_change') return Math.abs((b.lastPrice - b.levelPrice) / b.levelPrice) - Math.abs((a.lastPrice - a.levelPrice) / a.levelPrice)
      if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol)
      if (sortBy === 'price') return b.lastPrice - a.lastPrice
      return 0
    })

  const maxVal = Math.max(...bids.map((x) => x.valueUsd), ...asks.map((x) => x.valueUsd), 1)
  const pct = (v: number) => (v / maxVal) * 100

  function getSupportStrengthColor(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'strong': return '#22c55e'
    case 'medium': return '#f59e0b'
    case 'weak': return '#ef4444'
    default: return '#6b7280'
  }
}

function getSupportStrengthText(strength: 'weak' | 'medium' | 'strong'): string {
  switch (strength) {
    case 'strong': return 'Сильная'
    case 'medium': return 'Средняя'
    case 'weak': return 'Слабая'
    default: return 'Неизвестно'
  }
}

function formatVol(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M$'
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K$'
  return v.toFixed(0) + '$'
}

  return (
    <div className={s.wrap}>
      <div className={s.toolbar}>
        <label>Монета</label>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={s.select}>
          {symbols.map((sym) => (
            <option key={sym} value={sym}>{sym.replace('USDT', '')}.F</option>
          ))}
        </select>
        <span className={s.hint}>Карта плотностей по стакану фьючерсов Bybit. Большие объёмы на уровнях — зоны ликвидности.</span>
      </div>
      {loading && <div className={s.loading}>Загрузка стакана…</div>}
      {!loading && (
        <div className={s.content}>
          <div className={s.sideLabel}>Покупки (bid)</div>
          <div className={s.obArea}>
            <div className={s.asks}>
              {asks.slice().reverse().slice(0, 50).map((l, i) => (
                <div key={i} className={s.row} style={{ '--pct': pct(l.valueUsd) + '%' } as React.CSSProperties}>
                  <span className={s.priceRed}>{l.price.toFixed(4)}</span>
                  <span className={s.size}>{l.size.toLocaleString()}</span>
                  <span className={s.barWrap}><span className={s.barAsk} style={{ width: pct(l.valueUsd) + '%' }} /></span>
                </div>
              ))}
            </div>
            <div className={s.midLine}>
              <span>Цена: {mid.toFixed(4)}</span>
            </div>
            <div className={s.bids}>
              {bids.slice(0, 50).map((l, i) => (
                <div key={i} className={s.row}>
                  <span className={s.priceGreen}>{l.price.toFixed(4)}</span>
                  <span className={s.size}>{l.size.toLocaleString()}</span>
                  <span className={s.barWrap}><span className={s.barBid} style={{ width: pct(l.valueUsd) + '%' }} /></span>
                </div>
              ))}
            </div>
          </div>
          <div className={s.sideLabel}>Продажи (ask)</div>
        </div>
      )}

      <section className={s.volumeNearSection}>
        <h3 className={s.volumeNearTitle}>Монеты с высокой плотностью у цены</h3>
        <p className={s.volumeNearHint}>Показываются монеты с объемом 24h от $1M, у которых крупный объём в стакане находится рядом с текущей ценой. Фильтр плотности отсеивает монеты со слабыми уровнями поддержки/сопротивления.</p>
        <div className={s.volumeNearToolbar}>
          <label>
            Макс. расстояние от цены (%):
            <input
              type="number"
              min={0.1}
              max={20}
              step={0.5}
              value={maxDistancePct}
              onChange={(e) => setMaxDistancePct(parseFloat(e.target.value) || 4)}
              className={s.volumeNearInput}
            />
          </label>
          <label>
            Мин. объём у уровня ($):
            <input
              type="number"
              min={0}
              value={minVolumeUsd || ''}
              onChange={(e) => setMinVolumeUsd(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className={s.volumeNearInput}
            />
          </label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'distance' | 'volume' | 'density' | 'price_change' | 'symbol' | 'price')} className={s.select}>
            <option value="density">По плотности (рекомендуется)</option>
            <option value="distance">По близости к цене</option>
            <option value="volume">По объёму у уровня</option>
            <option value="price_change">По изменению цены (%)</option>
            <option value="symbol">По названию монеты</option>
            <option value="price">По цене</option>
          </select>
          <button className={s.refreshBtn} onClick={loadVolumeNearPrice} disabled={volumeNearLoading}>
            {volumeNearLoading ? 'Загрузка…' : 'Обновить'}
          </button>
        </div>
        {volumeNearLoading && <div className={s.loading}>Загрузка списка монет…</div>}
        {!volumeNearLoading && (
          <div className={s.volumeNearTableWrap}>
            <table className={s.volumeNearTable}>
              <thead>
                <tr>
                  <th onClick={() => setSortBy('symbol')}>Монета ↕</th>
                  <th onClick={() => setSortBy('price')}>Цена ↕</th>
                  <th onClick={() => setSortBy('distance')}>Расстояние % ↕</th>
                  <th onClick={() => setSortBy('volume')}>Объём у уровня ↕</th>
                  <th onClick={() => setSortBy('density')}>Плотность ↕</th>
                  <th>Сила уровня</th>
                  <th onClick={() => setSortBy('price_change')}>Уровень ↕</th>
                </tr>
              </thead>
              <tbody>
                {filteredVolumeNear.map((r) => (
                  <tr key={r.symbol}>
                    <td>{r.symbol.replace('USDT', '')}</td>
                    <td>{r.lastPrice.toFixed(4)}</td>
                    <td>{r.distancePct.toFixed(2)}%</td>
                    <td>{formatVol(r.volumeAtLevel)}</td>
                    <td>{(r.densityRatio * 100).toFixed(2)}%</td>
                    <td>
                      <span 
                        style={{ 
                          color: getSupportStrengthColor(r.supportStrength),
                          fontWeight: 600
                        }}
                      >
                        {getSupportStrengthText(r.supportStrength)}
                      </span>
                    </td>
                    <td>{r.levelPrice.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
