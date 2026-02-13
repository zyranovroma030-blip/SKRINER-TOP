import { useState } from 'react'
import { useScreenerStore, type SmartAlert } from '../store/screener'
import s from './SmartAlertManager.module.css'

const COOLDOWN_MS = 24 * 60 * 60 * 1000

export default function SmartAlertManager() {
  const { smartAlerts, addSmartAlert, removeSmartAlert, updateSmartAlert, resetSmartAlertCooldown } = useScreenerStore()
  const [showForm, setShowForm] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<SmartAlert | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'price_change' as SmartAlert['type'],
    timePeriod: '2h' as SmartAlert['timePeriod'],
    threshold: 20,
    minVolume: 0,
    maxVolume: 0,
    blacklist: ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT'],
    enabled: true
  })

  const openCreate = () => {
    setSelectedAlert(null)
    setFormData({
      name: '',
      type: 'price_change',
      timePeriod: '2h',
      threshold: 20,
      minVolume: 0,
      maxVolume: 0,
      blacklist: ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT'],
      enabled: true,
    })
    setShowForm(true)
  }

  const getCooldownCount = (alert: SmartAlert): number => {
    const map = alert.sentBySymbol ?? {}
    const now = Date.now()
    let n = 0
    for (const k of Object.keys(map)) {
      if (now - map[k] < COOLDOWN_MS) n += 1
    }
    return n
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedAlert) {
      updateSmartAlert(selectedAlert.id, formData)
    } else {
      addSmartAlert(formData)
    }
    setFormData({
      name: '',
      type: 'price_change',
      timePeriod: '2h',
      threshold: 20,
      minVolume: 0,
      maxVolume: 0,
      blacklist: ['BTCUSDT', 'ETHUSDT', 'XRPUSDT', 'SOLUSDT'],
      enabled: true
    })
    setShowForm(false)
    setSelectedAlert(null)
  }

  const handleUpdateAlert = (alert: SmartAlert) => {
    setSelectedAlert(alert)
    setShowForm(true)
    setFormData({
      name: alert.name,
      type: alert.type,
      timePeriod: alert.timePeriod,
      threshold: alert.threshold,
      minVolume: alert.minVolume || 0,
      maxVolume: alert.maxVolume || 0,
      blacklist: alert.blacklist,
      enabled: alert.enabled
    })
  }

  
  const getTypeLabel = (type: SmartAlert['type']) => {
    switch (type) {
      case 'price_change': return 'Изменение цены'
      case 'volatility': return 'Волатильность'
      case 'volume_spike': return 'Всплеск объема'
      case 'density_appearance': return 'Появление плотности'
      default: return type
    }
  }

  const getTimeLabel = (period: SmartAlert['timePeriod']) => {
    switch (period) {
      case '1h': return '1 час'
      case '2h': return '2 часа'
      case '3h': return '3 часа'
      case '6h': return '6 часов'
      case '10h': return '10 часов'
      case '16h': return '16 часов'
      case '24h': return '24 часа'
      default: return period
    }
  }

  return (
    <div className={s.container}>
      <div className={s.header}>
        <h3>Умные оповещения</h3>
        <button className={s.addButton} onClick={openCreate}>
          + Добавить оповещение
        </button>
      </div>

      {showForm && (
        <div className={s.modal}>
          <div className={s.modalContent}>
            <div className={s.modalHeader}>
              <h4>{selectedAlert ? 'Редактировать оповещение' : 'Создать новое оповещение'}</h4>
              <button className={s.closeButton} onClick={() => {
                setShowForm(false)
                setSelectedAlert(null)
              }}>×</button>
            </div>

            <div className={s.customAlert}>
              <h4>{selectedAlert ? 'Редактировать оповещение' : 'Создать новое оповещение'}</h4>
              <form onSubmit={handleSubmit} className={s.form}>
                <div className={s.formGroup}>
                  <label>Название оповещения</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Например: Рост на 20% за 2 часа"
                    required
                  />
                </div>

                <div className={s.formGroup}>
                  <label>Тип</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as SmartAlert['type'] })}
                  >
                    <option value="price_change">Изменение цены</option>
                    <option value="volatility">Волатильность</option>
                    <option value="volume_spike">Всплеск объема</option>
                    <option value="density_appearance">Плотность</option>
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label>Период</label>
                  <select
                    value={formData.timePeriod}
                    onChange={(e) => setFormData({ ...formData, timePeriod: e.target.value as SmartAlert['timePeriod'] })}
                  >
                    <option value="1h">1 час</option>
                    <option value="2h">2 часа</option>
                    <option value="3h">3 часа</option>
                    <option value="6h">6 часов</option>
                    <option value="10h">10 часов</option>
                    <option value="16h">16 часов</option>
                    <option value="24h">24 часа</option>
                  </select>
                </div>

                <div className={s.formGroup}>
                  <label>Порог (%)</label>
                  <input
                    type="number"
                    value={formData.threshold}
                    onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                    min="0.1"
                    step="0.1"
                    required
                  />
                </div>

                <div className={s.formRow}>
                  <div className={s.formGroup}>
                    <label>Мин. объем ($)</label>
                    <input
                      type="number"
                      value={formData.minVolume}
                      onChange={(e) => setFormData({ ...formData, minVolume: parseFloat(e.target.value) })}
                      min="0"
                      step="100000"
                    />
                  </div>
                  <div className={s.formGroup}>
                    <label>Макс. объем ($)</label>
                    <input
                      type="number"
                      value={formData.maxVolume}
                      onChange={(e) => setFormData({ ...formData, maxVolume: parseFloat(e.target.value) })}
                      min="0"
                      step="100000"
                    />
                  </div>
                </div>

                <div className={s.formGroup}>
                  <label>Черный список</label>
                  <input
                    type="text"
                    value={formData.blacklist.join(', ')}
                    onChange={(e) => setFormData({ ...formData, blacklist: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })}
                    placeholder="BTCUSDT, ETHUSDT, XRPUSDT, SOLUSDT"
                  />
                </div>

                <div className={s.formGroup}>
                  <label className={s.checkLabel}>
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    />
                    Включено
                  </label>
                </div>

                <div className={s.formActions}>
                  <button 
                    className={s.cancelButton}
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setSelectedAlert(null)
                    }}
                  >
                    Отмена
                  </button>
                  <button className={s.createButton} type="submit">
                    {selectedAlert ? 'Сохранить изменения' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className={s.alertsList}>
        {smartAlerts.length === 0 ? (
          <div className={s.emptyState}>
            <p>Нет созданных умных оповещений</p>
            <p>Создайте оповещение, чтобы получать уведомления о важных событиях на рынке</p>
          </div>
        ) : (
          smartAlerts.map((alert) => (
            <div key={alert.id} className={s.alertCard}>
              <div className={s.alertHeader}>
                <h4>{alert.name}</h4>
                <div className={s.alertControls}>
                  <button
                    className={s.editButton}
                    onClick={() => handleUpdateAlert(alert)}
                  >
                    Изменить
                  </button>
                  <button
                    className={`${s.toggleButton} ${alert.enabled ? s.enabled : s.disabled}`}
                    onClick={() => updateSmartAlert(alert.id, { enabled: !alert.enabled })}
                  >
                    {alert.enabled ? 'Вкл' : 'Выкл'}
                  </button>
                  <button
                    className={s.deleteButton}
                    onClick={() => {
                      if (confirm('Вы уверены, что хотите удалить это оповещение?')) {
                        removeSmartAlert(alert.id)
                      }
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
              <div className={s.alertDetails}>
                <div className={s.detailItem}>
                  <span className={s.label}>Тип:</span>
                  <span className={s.value}>{getTypeLabel(alert.type)}</span>
                </div>
                <div className={s.detailItem}>
                  <span className={s.label}>Период:</span>
                  <span className={s.value}>{getTimeLabel(alert.timePeriod)}</span>
                </div>
                <div className={s.detailItem}>
                  <span className={s.label}>Порог:</span>
                  <span className={s.value}>{alert.threshold}%</span>
                </div>
                {(alert.minVolume && alert.minVolume > 0 || alert.maxVolume && alert.maxVolume > 0) && (
                  <div className={s.detailItem}>
                    <span className={s.label}>Объем:</span>
                    <span className={s.value}>
                      {alert.minVolume && alert.minVolume > 0 && `от $${(alert.minVolume / 1000000).toFixed(1)}M`}
                      {alert.minVolume && alert.minVolume > 0 && alert.maxVolume && alert.maxVolume > 0 && ' - '}
                      {alert.maxVolume && alert.maxVolume > 0 && `до $${(alert.maxVolume / 1000000).toFixed(1)}M`}
                    </span>
                  </div>
                )}
                {alert.blacklist.length > 0 && (
                  <div className={s.detailItem}>
                    <span className={s.label}>Исключения:</span>
                    <span className={s.value}>{alert.blacklist.join(', ')}</span>
                  </div>
                )}
                {alert.lastTriggered && (
                  <div className={s.detailItem}>
                    <span className={s.label}>Последнее срабатывание:</span>
                    <span className={s.value}>
                      {new Date(alert.lastTriggered).toLocaleString()}
                    </span>
                  </div>
                )}

                <div className={s.detailItem}>
                  <span className={s.label}>Монет в кулдауне (24ч):</span>
                  <span className={s.value}>{getCooldownCount(alert)}</span>
                  {getCooldownCount(alert) > 0 && (
                    <button
                      className={s.resetCooldownBtn}
                      onClick={() => {
                        if (confirm('Сбросить кулдаун для всех монет этого оповещения?')) {
                          resetSmartAlertCooldown(alert.id)
                        }
                      }}
                      title="Сбросить кулдаун"
                    >
                      🔄 Сбросить
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
