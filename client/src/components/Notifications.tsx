import { useState, useEffect } from 'react'
import { X, Bell, BellOff } from 'lucide-react'
import s from './Notifications.module.css'

const STORAGE_KEY = 'bybit-screener-notifications'

function loadNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveNotifications(notifications: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications))
}

export interface Notification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: number
  symbol?: string
  read: boolean
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    saveNotifications(notifications)
  }, [notifications])

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      read: false
    }
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    
    // Автоматически скрываем success/info через 5 секунд
    if (notification.type === 'success' || notification.type === 'info') {
      setTimeout(() => {
        setNotifications(prev => prev.map(n => 
          n.id === newNotification.id ? { ...n, read: true } : n
        ))
      }, 5000)
    }
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const clearAll = () => {
    setNotifications([])
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return {
    notifications,
    showNotifications,
    setShowNotifications,
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    unreadCount
  }
}

export default function Notifications() {
  const { 
    notifications, 
    showNotifications, 
    setShowNotifications, 
    removeNotification,
    markAsRead,
    clearAll,
    unreadCount 
  } = useNotifications()

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'только что'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`
    return date.toLocaleDateString('ru-RU')
  }

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📢'
    }
  }

  return (
    <div className={s.notificationsContainer}>
      <button 
        className={s.bellButton}
        onClick={() => setShowNotifications(!showNotifications)}
        title={unreadCount > 0 ? `${unreadCount} новых уведомлений` : 'Уведомления'}
      >
        {unreadCount > 0 ? <Bell size={20} /> : <BellOff size={20} />}
        {unreadCount > 0 && (
          <span className={s.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {showNotifications && (
        <div className={s.notificationsPanel}>
          <div className={s.header}>
            <h3>Уведомления</h3>
            <div className={s.actions}>
              {notifications.length > 0 && (
                <button className={s.clearBtn} onClick={clearAll}>
                  Очистить все
                </button>
              )}
              <button className={s.closeBtn} onClick={() => setShowNotifications(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className={s.list}>
            {notifications.length === 0 ? (
              <div className={s.empty}>
                <BellOff size={32} />
                <p>Нет уведомлений</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`${s.notification} ${s[notification.type]} ${!notification.read ? s.unread : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className={s.content}>
                    <div className={s.headerRow}>
                      <span className={s.icon}>{getTypeIcon(notification.type)}</span>
                      <span className={s.time}>{formatTime(notification.timestamp)}</span>
                      <button 
                        className={s.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeNotification(notification.id)
                        }}
                        title="Удалить уведомление"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className={s.title}>{notification.title}</div>
                    <div className={s.message}>{notification.message}</div>
                    {notification.symbol && (
                      <div className={s.symbol}>{notification.symbol}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
