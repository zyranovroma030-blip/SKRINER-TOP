import { useState } from 'react'
import { useScreenerStore } from '../store/screener'
import SmartAlertManager from './SmartAlertManager'
import s from './SmartAlertsPage.module.css'

export default function SmartAlertsPage() {
  const {
    smartAlerts,
    smartAlertsSettings,
    setSmartAlertsSettings,
    telegramChatId,
    smartAlertsChecking,
    smartAlertsCheckLogs,
    clearSmartAlertsCheckLogs,
    addSmartAlertsCheckLog,
  } = useScreenerStore()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showLogs, setShowLogs] = useState(false)

  const [settingsDraft, setSettingsDraft] = useState(() => ({
    checkIntervalMs: smartAlertsSettings.checkIntervalMs,
    maxAlerts: smartAlertsSettings.maxAlerts,
    autoFilter: smartAlertsSettings.autoFilter,
    adaptiveThreshold: smartAlertsSettings.adaptiveThreshold,
  }))

  const openSettings = () => {
    setSettingsDraft({
      checkIntervalMs: smartAlertsSettings.checkIntervalMs,
      maxAlerts: smartAlertsSettings.maxAlerts,
      autoFilter: smartAlertsSettings.autoFilter,
      adaptiveThreshold: smartAlertsSettings.adaptiveThreshold,
    })
    setShowSettingsModal(true)
  }

  const stats = {
    total: smartAlerts.length,
    active: smartAlerts.filter(alert => alert.enabled).length,
    triggered: smartAlerts.filter(alert => alert.lastTriggered).length,
  }

  return (
    <div className={s.container}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.headerContent}>
          <div className={s.headerLeft}>
            <h1>Умные оповещения</h1>
            <p>Автоматический мониторинг рынка 24/7 с настраиваемыми условиями</p>
          </div>
          <div className={s.stats}>
            <div className={s.statItem}>
              <span className={s.statNumber}>{stats.total}</span>
              <span className={s.statLabel}>Всего</span>
            </div>
            <div className={s.statItem}>
              <span className={s.statNumber}>{stats.active}</span>
              <span className={s.statLabel}>Активны</span>
            </div>
            <div className={s.statItem}>
              <span className={s.statNumber}>{stats.triggered}</span>
              <span className={s.statLabel}>Сработали</span>
            </div>
          </div>
        </div>
        <div className={s.headerButtons}>
          <button 
            className={s.logsButton}
            onClick={() => setShowLogs(!showLogs)}
          >
            <span className={s.buttonIcon}>📋</span>
            Лог проверок {smartAlertsCheckLogs.length > 0 && `(${smartAlertsCheckLogs.length})`}
          </button>
          <button 
            className={s.settingsButton}
            onClick={openSettings}
          >
            <span className={s.buttonIcon}>⚙️</span>
            Параметры
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={s.content}>
        {/* Статус системы */}
        <div className={s.systemStatus}>
          <div className={s.statusItem}>
            <span className={s.statusLabel}>Telegram Chat ID:</span>
            <span className={telegramChatId ? s.statusOk : s.statusError}>
              {telegramChatId ? '✅ Настроен' : '❌ Не настроен (зайдите в Профиль)'}
            </span>
          </div>
          <div className={s.statusItem}>
            <span className={s.statusLabel}>Активных оповещений:</span>
            <span className={stats.active > 0 ? s.statusOk : s.statusError}>
              {stats.active > 0 ? `${stats.active}` : '0 (создайте оповещение)'}
            </span>
          </div>
          <div className={s.statusItem}>
            <span className={s.statusLabel}>Интервал проверки:</span>
            <span>10 секунд</span>
          </div>
        </div>

        {/* Индикатор проверки */}
        {smartAlertsChecking && (
          <div className={s.checkingIndicator}>
            <span className={s.spinner}></span>
            <span>Проверка монет...</span>
          </div>
        )}

        {/* Лог проверок */}
        {showLogs && (
          <div className={s.logsSection}>
            <div className={s.logsHeader}>
              <h3>📋 Лог проверок</h3>
              <div className={s.logsActions}>
                <button className={s.refreshLogsBtn} onClick={() => {
                  addSmartAlertsCheckLog({
                    time: Date.now(),
                    alertName: 'Ручная проверка',
                    checkedCoins: 0,
                    matchedCoins: 0,
                    sentSymbols: [],
                  })
                }}>
                  🔄 Обновить
                </button>
                <button className={s.clearLogsBtn} onClick={clearSmartAlertsCheckLogs}>
                  Очистить
                </button>
              </div>
            </div>
            <div className={s.logsList}>
              {smartAlertsCheckLogs.slice(0, 10).map((log, idx) => (
                <div key={idx} className={s.logItem + (log.error ? ' ' + s.logError : '')}>
                  <div className={s.logTime}>{new Date(log.time).toLocaleTimeString()}</div>
                  <div className={s.logAlert}>{log.alertName}</div>
                  <div className={s.logStats}>
                    Проверено: {log.checkedCoins} | Совпало: {log.matchedCoins}
                    {log.sentSymbols.length > 0 && (
                      <span className={s.logSent}> | Отправлено: {log.sentSymbols.join(', ')}</span>
                    )}
                  </div>
                  {log.error && <div className={s.logErrorText}>{log.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        <SmartAlertManager />
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className={s.modalOverlay} onClick={() => setShowSettingsModal(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2>Параметры умных оповещений</h2>
              <button 
                className={s.closeButton}
                onClick={() => setShowSettingsModal(false)}
              >
                ×
              </button>
            </div>
            <div className={s.modalContent}>
              <div className={s.settingsSection}>
                <h3>🔔 Настройки уведомлений</h3>
                <div className={s.settingItem}>
                  <label>Звуковые уведомления</label>
                  <select className={s.select}>
                    <option>Включены</option>
                    <option>Выключены</option>
                  </select>
                </div>
                <div className={s.settingItem}>
                  <label>Telegram Chat ID</label>
                  <input
                    className={s.input}
                    value={telegramChatId || ''}
                    disabled
                  />
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    Chat ID берётся из вкладки «Профиль». Здесь менять не нужно.
                  </p>
                </div>
              </div>

              <div className={s.settingsSection}>
                <h3>⚙️ Общие настройки</h3>
                <div className={s.settingItem}>
                  <label>Интервал проверки</label>
                  <select className={s.select} value="10000" disabled>
                    <option value="10000">10 секунд</option>
                  </select>
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    Фиксировано: каждые 10 секунд проверяем все монеты 24/7.
                  </p>
                </div>
                <div className={s.settingItem}>
                  <label>Максимальное количество оповещений</label>
                  <input 
                    type="number" 
                    value={settingsDraft.maxAlerts}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, maxAlerts: Math.max(1, parseInt(e.target.value || '1', 10)) }))}
                    className={s.input}
                  />
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    Защита от перегруза: если оповещений больше лимита — новые лучше не добавлять.
                  </p>
                </div>
              </div>

              <div className={s.settingsSection}>
                <h3>🎯 Умные настройки</h3>
                <div className={s.settingItem}>
                  <label>Автофильтрация ложных срабатываний</label>
                  <select
                    className={s.select}
                    value={settingsDraft.autoFilter ? 'on' : 'off'}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, autoFilter: e.target.value === 'on' }))}
                  >
                    <option value="on">Включена</option>
                    <option value="off">Выключена</option>
                  </select>
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    Уменьшает количество повторных/пустых уведомлений (анти-спам).
                  </p>
                </div>
                <div className={s.settingItem}>
                  <label>Адаптивный порог</label>
                  <select
                    className={s.select}
                    value={settingsDraft.adaptiveThreshold ? 'on' : 'off'}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, adaptiveThreshold: e.target.value === 'on' }))}
                  >
                    <option value="off">Выключен</option>
                    <option value="on">Включен</option>
                  </select>
                  <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
                    Если включить — пороги оповещений могут подстраиваться под рыночную активность.
                  </p>
                </div>
              </div>

              <div className={s.modalActions}>
                <button 
                  className={s.cancelButton}
                  onClick={() => setShowSettingsModal(false)}
                >
                  Отмена
                </button>
                <button 
                  className={s.primaryButton}
                  onClick={() => {
                    setSmartAlertsSettings(settingsDraft)
                    setShowSettingsModal(false)
                  }}
                >
                  Сохранить настройки
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
