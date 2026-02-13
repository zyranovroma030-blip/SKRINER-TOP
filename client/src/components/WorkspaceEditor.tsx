import { useState, useEffect } from 'react'
import { useScreenerStore } from '../store/screener'
import s from './WorkspaceEditor.module.css'

export interface WorkspaceEditorFilters {
  volumeMinUsd: number
  volumeMaxUsd: number
  priceChangeMinPct: number
  priceChangeMaxPct: number
  volatilityMinPct: number
  volatilityMaxPct: number
  btcCorrelationMinPct: number
  btcCorrelationMaxPct: number
  blacklist: string[]
  candleCount: number
}

const DEFAULT_FILTERS: WorkspaceEditorFilters = {
  volumeMinUsd: 70, // Теперь в сотнях тысяч (70 = $7M)
  volumeMaxUsd: 0, // 0 = без ограничения
  priceChangeMinPct: -100,
  priceChangeMaxPct: 100,
  volatilityMinPct: 0,
  volatilityMaxPct: 100,
  btcCorrelationMinPct: 0,
  btcCorrelationMaxPct: 100,
  blacklist: [],
  candleCount: 400,
}

type TabId = 'start' | 'formation' | 'filters' | 'sort' | 'chart' | 'indicators'

export default function WorkspaceEditor({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave?: (f: WorkspaceEditorFilters) => void
}) {
  const {
    globalTimeframe,
    setGlobalTimeframe,
    workspaceFilters,
    workspaceSort,
    setWorkspaceFilters,
    setWorkspaceSort,
  } = useScreenerStore()
  const [tab, setTab] = useState<TabId>('filters')
  const [filters, setFilters] = useState<WorkspaceEditorFilters>(DEFAULT_FILTERS)
  const [sortTimeRange, setSortTimeRange] = useState(workspaceSort.sortTimeRange)
  const [sortUpdateFreq, setSortUpdateFreq] = useState(workspaceSort.sortUpdateFreq)
  const [chartInterval, setChartInterval] = useState('15m')
  const [blacklistInput, setBlacklistInput] = useState('')
  const [candleCount, setCandleCount] = useState(400)

  useEffect(() => {
    setFilters(workspaceFilters)
    setSortTimeRange(workspaceSort.sortTimeRange)
    setSortUpdateFreq(workspaceSort.sortUpdateFreq)
    setChartInterval(globalTimeframe)

    // Синхронизируем candleCount без перетирания остальных фильтров
    const savedCandleCount = localStorage.getItem('bybit-screener-candle-count')
    const savedValue = savedCandleCount ? parseInt(savedCandleCount) || 0 : 0
    const nextCandleCount = savedValue > 0 ? savedValue : (workspaceFilters.candleCount || 400)
    setCandleCount(nextCandleCount)
    setFilters((prev) => ({ ...prev, candleCount: nextCandleCount }))
  }, [workspaceFilters, workspaceSort, globalTimeframe])

  // Сохраняем количество свечей в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('bybit-screener-candle-count', candleCount.toString())
  }, [candleCount])

  const tabs: { id: TabId; label: string }[] = [
    { id: 'start', label: 'Начало' },
    { id: 'formation', label: 'Формация' },
    { id: 'filters', label: 'Фильтры' },
    { id: 'sort', label: 'Сортировка' },
    { id: 'chart', label: 'График' },
    { id: 'indicators', label: 'Индикаторы' },
  ]

  const handleSave = () => {
    setWorkspaceFilters(filters)
    setGlobalTimeframe(chartInterval as any)
    setWorkspaceSort({
      sortTimeRange,
      sortUpdateFreq,
    })
    onSave?.(filters)
    onClose()
  }

  const addBlacklist = () => {
    const coins = blacklistInput.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
    if (coins.length) {
      setFilters((f) => ({ ...f, blacklist: [...new Set([...f.blacklist, ...coins])] }))
      setBlacklistInput('')
    }
  }

  const removeBlacklist = (coin: string) => {
    setFilters((f) => ({ ...f, blacklist: f.blacklist.filter((c) => c !== coin) }))
  }

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <h2 className={s.title}>Редактирование рабочего пространства</h2>
          <button className={s.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={s.body}>
          <nav className={s.nav}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? s.navItemActive : s.navItem}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className={s.content}>
            {tab === 'filters' && (
              <>
                <div className={s.section}>
                  <label className={s.label}>Черный список</label>
                  <div className={s.row}>
                    <input
                      className={s.input}
                      placeholder="Добавить монету"
                      value={blacklistInput}
                      onChange={(e) => setBlacklistInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addBlacklist()}
                    />
                    <button className={s.smallBtn} onClick={addBlacklist}>Добавить</button>
                  </div>
                  {filters.blacklist.length > 0 && (
                    <div className={s.chips}>
                      {filters.blacklist.map((c) => (
                        <span key={c} className={s.chip}>
                          {c}
                          <button onClick={() => removeBlacklist(c)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={s.section}>
                    <label className={s.label}>Быстрые действия</label>
                    <div className={s.row}>
                      <button className={s.smallBtn} onClick={() => {
                        setFilters((f) => ({ ...f, blacklist: ['BTCUSDT', 'SOLUSDT', 'ETHUSDT', 'XRPUSDT'] }))
                      }}>
                        Добавить BTC, SOL, ETH, XRP
                      </button>
                      <button className={s.smallBtn} onClick={() => {
                        setFilters((f) => ({ ...f, blacklist: [] }))
                      }}>
                        Очистить черный список
                      </button>
                    </div>
                  </div>
                </div>
                <div className={s.section}>
                  <label className={s.label}>Фильтр по объёму (в сотнях тысяч $)</label>
                  <div className={s.rangeRow}>
                    <input
                      type="number"
                      className={s.input}
                      min={0}
                      placeholder="Мин (100 = $10M)"
                      value={filters.volumeMinUsd || ''}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          volumeMinUsd: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <span>—</span>
                    <input
                      type="number"
                      className={s.input}
                      min={0}
                      placeholder="Макс (0 = без огр.)"
                      value={filters.volumeMaxUsd || ''}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          volumeMaxUsd: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                    <span>Интервал: 24ч</span>
                  </div>
                  <p className={s.hint}>Введите значения в сотнях тысяч долларов. Например: 100 = $10M, 500 = $50M</p>
                </div>
                <div className={s.section}>
                  <label className={s.label}>Фильтр по изменению цены (%)</label>
                  <div className={s.rangeRow}>
                    <input type="number" className={s.input} value={filters.priceChangeMinPct} onChange={(e) => setFilters((f) => ({ ...f, priceChangeMinPct: parseFloat(e.target.value) || 0 }))} />
                    <span>—</span>
                    <input type="number" className={s.input} value={filters.priceChangeMaxPct} onChange={(e) => setFilters((f) => ({ ...f, priceChangeMaxPct: parseFloat(e.target.value) || 0 }))} />
                    <span>Интервал: 24ч</span>
                  </div>
                </div>
                <div className={s.section}>
                  <label className={s.label}>Фильтр по волатильности (%)</label>
                  <div className={s.rangeRow}>
                    <input type="number" className={s.input} value={filters.volatilityMinPct} onChange={(e) => setFilters((f) => ({ ...f, volatilityMinPct: parseFloat(e.target.value) || 0 }))} />
                    <span>—</span>
                    <input type="number" className={s.input} value={filters.volatilityMaxPct} onChange={(e) => setFilters((f) => ({ ...f, volatilityMaxPct: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className={s.section}>
                  <label className={s.label}>Фильтр по корреляции с BTC (%)</label>
                  <div className={s.rangeRow}>
                    <input type="number" className={s.input} value={filters.btcCorrelationMinPct} onChange={(e) => setFilters((f) => ({ ...f, btcCorrelationMinPct: parseFloat(e.target.value) || 0 }))} />
                    <span>—</span>
                    <input type="number" className={s.input} value={filters.btcCorrelationMaxPct} onChange={(e) => setFilters((f) => ({ ...f, btcCorrelationMaxPct: parseFloat(e.target.value) || 0 }))} />
                    <span>Интервал: 24ч</span>
                  </div>
                </div>
              </>
            )}
            {tab === 'sort' && (
              <>
                <div className={s.section}>
                  <label className={s.label}>Диапазон времени</label>
                  <select className={s.select} value={sortTimeRange} onChange={(e) => setSortTimeRange(e.target.value)}>
                    <option value="24h">За последние 24 часа</option>
                  </select>
                </div>
                <div className={s.section}>
                  <label className={s.label}>Частота обновления сортировки</label>
                  <select className={s.select} value={sortUpdateFreq} onChange={(e) => setSortUpdateFreq(e.target.value)}>
                    <option value="manual">Обновлять только вручную</option>
                    <option value="1">Каждую минуту</option>
                    <option value="5">Каждые 5 минут</option>
                  </select>
                </div>
              </>
            )}
            {tab === 'chart' && (
              <>
                <div className={s.section}>
                  <label className={s.label}>Временной интервал</label>
                  <div className={s.chartIntervals}>
                    {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                      <button
                        key={tf}
                        className={chartInterval === tf ? s.intervalActive : s.intervalBtn}
                        onClick={() => {
                          setChartInterval(tf)
                          setGlobalTimeframe(tf as any)
                        }}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={s.section}>
                  <label className={s.label}>Количество свечей</label>
                  <input 
                    type="number" 
                    className={s.input} 
                    value={candleCount} 
                    onChange={(e) => {
                    const newCandleCount = parseInt(e.target.value) || 400
                    setCandleCount(newCandleCount)
                    setFilters((prev) => ({ ...prev, candleCount: newCandleCount }))
                  }}
                  />
                </div>
                <div className={s.section}>
                  <label className={s.label}>Плотности</label>
                  <p className={s.hint}>Отображение плотностей по стакану на графике (карта плотностей в отдельной вкладке).</p>
                </div>
              </>
            )}
            {tab === 'formation' && (
              <div className={s.section}>
                <label className={s.label}>Выберите формацию</label>
                <div className={s.formationGrid}>
                  {['Без формаций', 'Горизонтальный уровень подтвержденный плотностью', 'Активные монеты', 'Монеты с плотностями', 'Горизонтальные уровни', 'Трендовые уровни'].map((name) => (
                    <button key={name} className={s.formationBtn}>{name}</button>
                  ))}
                </div>
              </div>
            )}
            {tab === 'indicators' && (
              <div className={s.section}>
                <p className={s.hint}>Индикаторы: технические данные по монете (объём, волатильность, корреляция, изменение цены), RSI, ATR, ликвидации, профиль объёма — отображаются на странице «Монеты» при выборе инструмента.</p>
              </div>
            )}
            {tab === 'start' && (
              <div className={s.section}>
                <p className={s.hint}>Настройте фильтры, сортировку и график в соответствующих вкладках.</p>
              </div>
            )}
          </div>
        </div>
        <div className={s.footer}>
          <button className={s.cancelBtn} onClick={onClose}>Отмена</button>
          <button className={s.saveBtn} onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
