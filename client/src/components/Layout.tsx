import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutGrid, User, Globe, Clock, RefreshCw } from 'lucide-react'
import { useScreenerStore, type LayoutColumns } from '../store/screener'
import type { TimeframeKey } from '../types'
import Notifications from './Notifications'
import { useSmartAlerts } from '../hooks/useSmartAlerts'
import s from './Layout.module.css'

const TABS = [
  { to: '/screener', label: 'Скринер' },
  { to: '/coins', label: 'Монеты' },
  { to: '/density', label: 'Карта плотностей' },
  { to: '/smart-alerts', label: 'Умные оповещения' },
  { to: '/listings', label: 'Листинги' },
  { to: '/formations', label: 'Формации' },
] as const

export default function Layout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate()
  const {
    globalTimeframe,
    setGlobalTimeframe,
    triggerRefresh,
    layoutColumns,
    setLayoutColumns,
  } = useScreenerStore()
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
  const [layoutOpen, setLayoutOpen] = useState(false)

  // Запускаем умные оповещения
  useSmartAlerts()

  return (
    <div className={s.layout}>
      <header className={s.header}>
        <div className={s.headerLeft}>
          <div className={s.logo}>BYBIT SCREENER</div>
          <nav className={s.tabs}>
            {TABS.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => [s.tab, isActive && s.active].filter(Boolean).join(' ')}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className={s.headerRight}>
          <Notifications />
          <div className={s.dropdownWrap}>
            <button
              className={s.iconBtn}
              title="Колонки (вид скринера)"
              onClick={() => setLayoutOpen(!layoutOpen)}
            >
              <LayoutGrid size={18} />
            </button>
            {layoutOpen && (
              <>
                <div className={s.dropdownBackdrop} onClick={() => setLayoutOpen(false)} />
                <div className={s.layoutPanel}>
                  <div className={s.layoutPanelTitle}>Вид скринера</div>
                  <div className={s.layoutOptions}>
                    {([2, 3, 4] as LayoutColumns[]).map((n) => (
                      <button
                        key={n}
                        className={s.layoutOption + (layoutColumns === n ? ' ' + s.layoutOptionActive : '')}
                        onClick={() => { setLayoutColumns(n); setLayoutOpen(false); }}
                      >
                        {n} колонки
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button className={s.iconBtn} title="Профиль" onClick={() => navigate('/profile')}>
            <User size={18} />
          </button>
          <div className={s.langSelect}>
            <Globe size={16} />
            <select defaultValue="Ru">
              <option value="Ru">Ru</option>
              <option value="En">En</option>
            </select>
          </div>
          <div className={s.timeframeSelect}>
            <Clock size={16} />
            <select value={globalTimeframe} onChange={(e) => setGlobalTimeframe(e.target.value as TimeframeKey)}>
              {timeframes.map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
          </div>
          <button className={s.iconBtn} title="Обновить" onClick={() => triggerRefresh()}>
            <RefreshCw size={18} />
          </button>
        </div>
      </header>
      <main className={s.main}>
        {children ?? <Outlet />}
      </main>
    </div>
  )
}
