import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Settings, Plus } from 'lucide-react'
import { useScreenerStore } from '../store/screener'
import { useBybitTickers } from '../hooks/useBybitTickers'
import MiniChart from '../components/MiniChart'
import WorkspaceEditor from '../components/WorkspaceEditor'
import s from './Screener.module.css'

type PresetId = 'volume' | 'volatility' | 'growth'

export default function Screener() {
  const navigate = useNavigate()
  const { globalTimeframe: screenerTimeframe, refreshKey, workspaceFilters, workspaceSort, layoutColumns, setWorkspaceSort } = useScreenerStore()
  const sortTypeEffective = workspaceSort.sortType
  const dirEffective = workspaceSort.sortDirection ?? 'desc'

  const preset: PresetId =
    sortTypeEffective === 'volume'
      ? 'volume'
      : sortTypeEffective === 'volatility'
        ? 'volatility'
        : 'growth'

  const setPreset = (p: PresetId) => {
    const nextSortType = p === 'volume' ? 'volume' : p === 'volatility' ? 'volatility' : 'price_change'
    if (nextSortType === sortTypeEffective) {
      setWorkspaceSort({ sortDirection: dirEffective === 'desc' ? 'asc' : 'desc' })
    } else {
      setWorkspaceSort({ sortType: nextSortType, sortDirection: 'desc' })
    }
  }
  const [showEditor, setShowEditor] = useState(false)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  
  // Используем candleCount из store
  const candleCount = workspaceFilters.candleCount

  const { list, loading, error } = useBybitTickers(refreshKey, {
    volumeMinUsd: workspaceFilters.volumeMinUsd,
    volumeMaxUsd: workspaceFilters.volumeMaxUsd || undefined,
    volatilityMinPct: workspaceFilters.volatilityMinPct,
    volatilityMaxPct: workspaceFilters.volatilityMaxPct,
    priceChangeMinPct: workspaceFilters.priceChangeMinPct,
    priceChangeMaxPct: workspaceFilters.priceChangeMaxPct,
    sortBy: sortTypeEffective as any,
    sortDirection: dirEffective,
    blacklist: workspaceFilters.blacklist,
    limit: 50, // Увеличиваем до 50 для показа всех графиков
  })

  return (
    <div className={s.wrap}>
      <aside className={leftCollapsed ? s.sidebarCollapsed : s.sidebar}>
        <button className={s.collapseBtn} onClick={() => setLeftCollapsed(!leftCollapsed)} title={leftCollapsed ? 'Открыть' : 'Свернуть'}>
          <ChevronLeft size={18} style={{ transform: leftCollapsed ? 'rotate(180deg)' : undefined }} />
        </button>
        {!leftCollapsed && (
          <>
            <div className={s.section}>
              <div className={s.sectionHeader}>
                <span className={s.sectionTitle}>Волатильность</span>
                <span className={s.tag}>фьюч</span>
                <div className={s.sectionIcons}>
                  <button onClick={() => setShowEditor(true)} title="Настройки"><Settings size={14} /></button>
                </div>
              </div>
              <button className={s.presetBtn + (preset === 'volatility' ? ' ' + s.active : '')} onClick={() => setPreset('volatility')}>
                По волатильности{preset === 'volatility' ? (dirEffective === 'desc' ? ' ↓' : ' ↑') : ''}
              </button>
            </div>
            <div className={s.section}>
              <div className={s.sectionHeader}>
                <span className={s.sectionTitle}>Объёмы</span>
                <span className={s.tag}>фьюч</span>
                <div className={s.sectionIcons}>
                  <button title="Настройки"><Settings size={14} /></button>
                </div>
              </div>
              <button className={s.presetBtn + (preset === 'volume' ? ' ' + s.active : '')} onClick={() => setPreset('volume')}>
                По объёму{preset === 'volume' ? (dirEffective === 'desc' ? ' ↓' : ' ↑') : ''}
              </button>
            </div>
            <div className={s.section}>
              <div className={s.sectionHeader}>
                <span className={s.sectionTitle}>Рост</span>
                <span className={s.tag}>фьюч</span>
                <div className={s.sectionIcons}>
                  <button title="Настройки"><Settings size={14} /></button>
                </div>
              </div>
              <button className={s.presetBtn + (preset === 'growth' ? ' ' + s.active : '')} onClick={() => setPreset('growth')}>
                По росту{preset === 'growth' ? (dirEffective === 'desc' ? ' ↓' : ' ↑') : ''}
              </button>
            </div>
            <button className={s.createBtn}>
              <Plus size={16} />
              Создать +
            </button>
          </>
        )}
      </aside>
      <div className={s.main}>
        {loading && <div className={s.loading}>Загрузка данных Bybit…</div>}
        {error && <div className={s.error}>{error}</div>}
        {!loading && !error && (
          <>
            <div style={{ marginBottom: '16px', color: 'var(--text-muted)', fontSize: '14px' }}>
              Найдено монет: {list.length}
            </div>
            <div className={s.grid} style={{ gridTemplateColumns: `repeat(${layoutColumns}, minmax(340px, 1fr))` }}>
              {list.map((coin) => (
                <MiniChart
                  key={coin.symbol}
                  symbol={coin.symbol}
                  timeframe={screenerTimeframe}
                  volume24h={coin.turnover24h}
                  change24hPct={coin.priceChange24hPct}
                  volatility24hPct={coin.volatility24hPct}
                  candleCount={candleCount}
                  onExpand={() => navigate(`/coins?symbol=${encodeURIComponent(coin.symbol)}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {showEditor && <WorkspaceEditor onClose={() => setShowEditor(false)} />}
    </div>
  )
}
