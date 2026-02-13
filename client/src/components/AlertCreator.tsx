import { useState, useEffect } from 'react'
import { X, ArrowLeft } from 'lucide-react'
import { getTickersLinear } from '../api/bybit'
import type { AlertType } from '../types'
import s from './AlertCreator.module.css'

interface AlertCreatorProps {
  onClose: () => void
  onBack: () => void
  type: AlertType
  onCreate: (type: AlertType, name: string, symbol: string | undefined, params: Record<string, number | string>) => void
}

interface ParamConfig {
  key: string
  label: string
  type: 'number' | 'select' | 'checkbox'
  default: number | string | boolean
  min?: number
  max?: number
  step?: number
  options?: string[]
}

interface TypeConfig {
  name: string
  description: string
  params: ParamConfig[]
  requiresSymbol?: boolean
}

const TYPE_CONFIGS: Record<string, TypeConfig> = {
  price_change: {
    name: 'Изменение цены 24ч',
    description: 'Уведомление при изменении цены за 24 часа',
    requiresSymbol: true,
    params: [
      { key: 'thresholdPct', label: 'Порог изменения (%)', type: 'number', default: 5, min: 0.1, max: 100 }
    ]
  },
  price_change_short_term: {
    name: 'Резкое изменение цены',
    description: 'Уведомление при резком изменении цены за короткий период',
    requiresSymbol: true,
    params: [
      { key: 'thresholdPct', label: 'Порог изменения (%)', type: 'number', default: 30, min: 1, max: 100 },
      { key: 'period', label: 'Период (минут)', type: 'select', options: ['5', '15', '30', '60', '180'], default: '5' },
      { key: 'interval', label: 'Интервал', type: 'select', options: ['5m', '1h'], default: '5m' }
    ]
  },
  volume_spike: {
    name: 'Всплеск объемов 24ч',
    description: 'Уведомление при большом объеме за 24 часа',
    requiresSymbol: true,
    params: [
      { key: 'minVolumeUsd', label: 'Минимальный объем ($)', type: 'number', default: 80000000, min: 100000 }
    ]
  },
  volume_spike_short_term: {
    name: 'Всплеск объемов',
    description: 'Уведомление при резком всплеске объема за короткий период',
    requiresSymbol: true,
    params: [
      { key: 'spikeRatio', label: 'Коэффициент всплеска (x)', type: 'number', default: 5, min: 2, max: 50 }
    ]
  },
  volatility: {
    name: 'Волатильность',
    description: 'Уведомление при высокой волатильности за 24 часа',
    requiresSymbol: true,
    params: [
      { key: 'thresholdPct', label: 'Порог волатильности (%)', type: 'number', default: 5, min: 1, max: 100 }
    ]
  },
  funding: {
    name: 'Фандинг',
    description: 'Уведомление при высоком или отрицательном фандинге',
    requiresSymbol: true,
    params: [
      { key: 'threshold', label: 'Порог фандинга (%)', type: 'number', default: 0.01, min: 0.001, max: 1, step: 0.001 }
    ]
  },
  // Новые типы для всех монет
  all_price_change: {
    name: 'Изменение цены (все монеты)',
    description: 'Уведомление об изменении цены у всех монет по фильтрам',
    requiresSymbol: false,
    params: [
      { key: 'thresholdPct', label: 'Порог изменения (%)', type: 'number', default: 10, min: 1, max: 100 },
      { key: 'minVolume', label: 'Мин. объем 24ч ($)', type: 'number', default: 80000000, min: 1000000 },
      { key: 'period', label: 'Период', type: 'select', options: ['5m', '15m', '1h', '4h', '24h'], default: '24h' }
    ]
  },
  all_volume_spike: {
    name: 'Всплеск объемов (все монеты)',
    description: 'Уведомление о всплеске объема у всех монет по фильтрам',
    requiresSymbol: false,
    params: [
      { key: 'spikeRatio', label: 'Коэффициент всплеска (x)', type: 'number', default: 3, min: 2, max: 20 },
      { key: 'minVolume', label: 'Мин. объем 24ч ($)', type: 'number', default: 50000000, min: 1000000 },
      { key: 'period', label: 'Период сравнения', type: 'select', options: ['5m vs 1h', '15m vs 4h', '1h vs 24h'], default: '1h vs 24h' }
    ]
  }
}

export default function AlertCreator({ onClose, onBack, type, onCreate }: AlertCreatorProps) {
  // Явно используем TYPE_CONFIGS чтобы избежать предупреждения
  const configs = TYPE_CONFIGS
  const config = configs[type]
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [symbols, setSymbols] = useState<string[]>([])
  const [params, setParams] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (config) {
      const defaultParams: Record<string, any> = {}
      config.params.forEach((p: ParamConfig) => {
        defaultParams[p.key] = p.default as number | string | boolean
      })
      setParams(defaultParams)
      setName(config.name)
    }
  }, [type, config])

  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const res = await getTickersLinear()
        const list = res.list
          .map((t: any) => t.symbol)
          .filter((sym: string) => sym.endsWith('USDT'))
          .sort()
        setSymbols(list)
      } catch (e) {
        console.error('Failed to load symbols:', e)
      }
    }
    loadSymbols()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return

    // Для оповещений для всех монет символ не требуется
    const finalSymbol = config.requiresSymbol ? symbol : undefined
    
    if (config.requiresSymbol && !symbol) {
      alert('Пожалуйста, выберите монету для этого типа оповещения')
      return
    }

    setLoading(true)
    try {
      onCreate(type, name, finalSymbol, params)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const updateParam = (key: string, value: number | string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  if (!config) {
    return (
      <div className={s.modalOverlay} onClick={onClose}>
        <div className={s.modal} onClick={(e) => e.stopPropagation()}>
          <div className={s.header}>
            <button className={s.backBtn} onClick={onBack}>
              <ArrowLeft size={16} />
            </button>
            <h3>Неизвестный тип оповещения</h3>
            <button className={s.closeBtn} onClick={onClose}>
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <button className={s.backBtn} onClick={onBack}>
            <ArrowLeft size={16} />
          </button>
          <h3>{config.name}</h3>
          <button className={s.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form className={s.form} onSubmit={handleSubmit}>
          <div className={s.description}>
            {config.description}
          </div>

          <div className={s.field}>
            <label>Название оповещения</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название..."
              required
            />
          </div>

          {config.requiresSymbol && (
            <div className={s.field}>
              <label>Монета</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              >
                <option value="">Выберите монету...</option>
                {symbols.map((sym) => (
                  <option key={sym} value={sym}>
                    {sym.replace('USDT', '')}.F
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.params.map((param) => (
            <div key={param.key} className={s.field}>
              <label>{param.label}</label>
              {param.type === 'select' ? (
                <select
                  value={params[param.key] as string}
                  onChange={(e) => updateParam(param.key, e.target.value)}
                >
                  {(param.options as string[]).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : param.type === 'checkbox' ? (
                <input
                  type="checkbox"
                  checked={!!params[param.key]}
                  onChange={(e) => updateParam(param.key, e.target.checked)}
                />
              ) : (
                <input
                  type="number"
                  value={params[param.key] as number}
                  onChange={(e) => updateParam(param.key, parseFloat(e.target.value) || 0)}
                  min={param.min}
                  max={param.max}
                  step={param.step || 0.1}
                  required
                />
              )}
            </div>
          ))}

          <div className={s.actions}>
            <button type="button" className={s.cancelBtn} onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className={s.createBtn} disabled={loading}>
              {loading ? 'Создание...' : 'Создать оповещение'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
