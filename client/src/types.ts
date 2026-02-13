import type { TickerLinear } from './api/bybit'

export type TimeframeKey = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

export interface CoinMetric extends TickerLinear {
  /** Волатильность 24h % = (high - low) / prev * 100 */
  volatility24hPct: number
  /** Объём 24h в USD (turnover) */
  volume24hUsd: number
  /** Изменение цены 24h % */
  priceChange24hPct: number
  /** Открытый интерес в USD (примерно) */
  openInterestUsd: number
  /** Фандинг rate */
  fundingRateNum: number
}

export type AlertType =
  | 'price_cross'
  | 'density'
  | 'price_change'
  | 'price_change_short_term'
  | 'btc_correlation'
  | 'volatility'
  | 'volume_spike'
  | 'volume_spike_short_term'
  | 'all_price_change'
  | 'all_volume_spike'
  | 'listing'
  | 'funding'
  | 'open_interest'

export interface AlertConfig {
  id: string
  type: AlertType
  symbol?: string
  name: string
  enabled: boolean
  params: Record<string, number | string>
  telegramChatId?: string
}

export interface WorkspaceFilters {
  volumeMinUsd: number
  volumeMaxUsd: number
  priceChangeMinPct: number
  priceChangeMaxPct: number
  volatilityMinPct: number
  volatilityMaxPct: number
  btcCorrelationMinPct: number
  btcCorrelationMaxPct: number
  blacklist: string[]
}

export interface WorkspaceSort {
  type: 'top_growth' | 'volume' | 'volatility' | 'trades'
  timeRange: '24h'
  pinAlerts: boolean
}
