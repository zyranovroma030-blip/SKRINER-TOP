import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'
import TelegramBot from 'node-telegram-bot-api'
import WebSocket, { WebSocketServer } from 'ws'

const app = express()
const PORT = process.env.PORT || 4001
const BYBIT = 'https://api.bybit.com'
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

app.use(cors({ origin: true }))
app.use(express.json())

let alertsState = { telegramChatId: '', alerts: [], lastFired: {} }

app.post('/api/alerts/sync', (req, res) => {
  const { telegramChatId, alerts } = req.body || {}
  alertsState.telegramChatId = telegramChatId || ''
  alertsState.alerts = Array.isArray(alerts) ? alerts : []
  res.json({ ok: true })
})

app.post('/api/notify', async (req, res) => {
  const { telegramChatId, text } = req.body || {}
  if (!telegramChatId || !text) return res.status(400).json({ error: 'telegramChatId and text required' })
  const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN) : null
  if (!bot) return res.json({ ok: false, sent: false })
  try {
    await bot.sendMessage(telegramChatId, text)
    res.json({ ok: true, sent: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.get('/api/alerts/check', async (req, res) => {
  await checkAlerts()
  res.json({ ok: true })
})

async function bybit(path, params = {}) {
  const url = new URL(BYBIT + path)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString())
  const j = await r.json()
  if (j.retCode !== 0) throw new Error(j.retMsg || 'Bybit error')
  return j.result
}

async function checkAlerts() {
  if (!alertsState.telegramChatId || !alertsState.alerts.length) return
  const bot = BOT_TOKEN ? new TelegramBot(BOT_TOKEN) : null
  if (!bot) return

  let tickers
  try {
    const result = await bybit('/v5/market/tickers', { category: 'linear' })
    tickers = (result.list || []).reduce((acc, t) => {
      acc[t.symbol] = t
      return acc
    }, {})
  } catch (e) {
    return
  }

  const now = Date.now()
  const cooldownMs = 60 * 60 * 1000

  for (const alert of alertsState.alerts) {
    if (!alert.enabled) continue
    const key = alert.id
    if (alertsState.lastFired[key] && now - alertsState.lastFired[key] < cooldownMs) continue

    let text = null
    
    // Существующие типы оповещений
    if (alert.type === 'price_change' && alert.symbol) {
      const t = tickers[alert.symbol]
      if (t) {
        const pct = (parseFloat(t.price24hPcnt) || 0) * 100
        const thresh = alert.params?.thresholdPct ?? 5
        if (Math.abs(pct) >= thresh) text = `${alert.symbol}: изменение цены 24h ${pct.toFixed(2)}%`
      }
    }
    
    if (alert.type === 'volatility' && alert.symbol) {
      const t = tickers[alert.symbol]
      if (t) {
        const prev = parseFloat(t.prevPrice24h) || parseFloat(t.lastPrice)
        const high = parseFloat(t.highPrice24h)
        const low = parseFloat(t.lowPrice24h)
        const volPct = prev ? ((high - low) / prev) * 100 : 0
        const thresh = alert.params?.thresholdPct ?? 5
        if (volPct >= thresh) text = `${alert.symbol}: волатильность 24h ${volPct.toFixed(2)}%`
      }
    }
    
    if (alert.type === 'volume_spike' && alert.symbol) {
      const t = tickers[alert.symbol]
      if (t) {
        const vol = parseFloat(t.turnover24h) || 0
        const thresh = alert.params?.minVolumeUsd ?? 1e9
        if (vol >= thresh) text = `${alert.symbol}: объём 24h ${(vol / 1e9).toFixed(2)}B$`
      }
    }
    
    if (alert.type === 'funding' && alert.symbol) {
      const t = tickers[alert.symbol]
      if (t) {
        const fr = parseFloat(t.fundingRate) || 0
        const thresh = alert.params?.threshold ?? 0.0001
        if (Math.abs(fr) >= thresh) text = `${alert.symbol}: фандинг ${(fr * 100).toFixed(4)}%`
      }
    }

    // Новые типы оповещений для всех монет
    if (alert.type === 'all_price_change') {
      // Проверяем все монеты по фильтрам
      const minVolume = alert.params?.minVolume || 80000000
      const threshold = alert.params?.thresholdPct || 10
      const period = alert.params?.period || '24h'
      
      for (const symbol in tickers) {
        const t = tickers[symbol]
        if (!t) continue
        
        const vol = parseFloat(t.turnover24h) || 0
        if (vol < minVolume) continue
        
        const pct = (parseFloat(t.price24hPcnt) || 0) * 100
        if (Math.abs(pct) >= threshold) {
          text = `${symbol}: изменение цены ${period} ${pct.toFixed(2)}%`
          break
        }
      }
    }

    if (alert.type === 'all_volume_spike') {
      // Проверяем всплески объема у всех монет
      const minVolume = alert.params?.minVolume || 50000000
      const spikeRatio = alert.params?.spikeRatio || 3
      const period = alert.params?.period || '1h vs 24h'
      
      for (const symbol in tickers) {
        const t = tickers[symbol]
        if (!t) continue
        
        const vol = parseFloat(t.turnover24h) || 0
        if (vol < minVolume) continue
        
        // Анализируем разные периоды
        try {
          let currentVolume = 0
          let previousVolume = 0
          
          if (period === '5m vs 1h') {
            // Сравниваем последние 5 минут с предыдущим часом
            const klines5m = await bybit('/market/kline', { 
              category: 'linear', 
              symbol, 
              interval: '5', 
              limit: 2 
            })
            const klines1h = await bybit('/market/kline', { 
              category: 'linear', 
              symbol, 
              interval: '60', 
              limit: 2 
            })
            
            if (klines5m.list && klines1h.list) {
              currentVolume = parseFloat(klines5m.list[0][5]) || 0
              previousVolume = parseFloat(klines1h.list[0][5]) || 0
            }
          } else if (period === '15m vs 4h') {
            const klines15m = await bybit('/market/kline', { 
              category: 'linear', 
              symbol, 
              interval: '15', 
              limit: 4 
            })
            const klines4h = await bybit('/market/kline', { 
              category: 'linear', 
              symbol, 
              interval: '240', 
              limit: 4 
            })
            
            if (klines15m.list && klines4h.list) {
              currentVolume = klines15m.list.slice(-1).reduce((sum, k) => sum + parseFloat(k[5]), 0)
              previousVolume = klines4h.list.slice(-4, -1).reduce((sum, k) => sum + parseFloat(k[5]), 0)
            }
          } else if (period === '1h vs 24h') {
            const klines1h = await bybit('/market/kline', { 
              category: 'linear', 
              symbol, 
              interval: '60', 
              limit: 2 
            })
            const klines24h = await bybit('/market/kline', { 
              category: 'linear', 
              symbol, 
              interval: 'D', 
              limit: 2 
            })
            
            if (klines1h.list && klines24h.list) {
              currentVolume = parseFloat(klines1h.list[0][5]) || 0
              previousVolume = parseFloat(klines24h.list[0][5]) || 0
            }
          }
          
          if (previousVolume > 0 && currentVolume / previousVolume >= spikeRatio) {
            text = `${symbol}: всплеск объема ${period} ${(currentVolume / previousVolume).toFixed(1)}x!`
            break
          }
        } catch (e) {
          // Игнорируем ошибки при получении данных
        }
      }
    }

    // Существующие типы оповещений (короткие периоды)
    if (alert.type === 'price_change_short_term' && alert.symbol) {
      try {
        const interval = alert.params?.interval ?? '5m'
        const threshold = alert.params?.thresholdPct ?? 30
        const period = alert.params?.period ?? '5'
        
        const klines = await bybit('/market/kline', { 
          category: 'linear', 
          symbol: alert.symbol, 
          interval: interval === '5m' ? '5' : '60', 
          limit: Math.ceil(period / (interval === '5m' ? 5 : 60)) + 1 
        })
        
        if (klines.list && klines.list.length >= 2) {
          const current = parseFloat(klines.list[klines.list.length - 1][4]) // текущая цена
          const previous = parseFloat(klines.list[0][4]) // цена начала периода
          const changePct = Math.abs((current - previous) / previous) * 100
          
          if (changePct >= threshold) {
            const direction = current > previous ? '📈' : '📉'
            text = `${alert.symbol}: ${direction} изменение цены ${changePct.toFixed(1)}% за последние ${period} минут!`
          }
        }
      } catch (e) {
        // Игнорируем ошибки при получении данных
      }
    }

    if (alert.type === 'volume_spike_short_term' && alert.symbol) {
      try {
        const klines5m = await bybit('/market/kline', { 
          category: 'linear', 
          symbol: alert.symbol, 
          interval: '5', 
          limit: 12 // 12 свечей по 5 минут = 1 час
        })
        const klines1h = await bybit('/market/kline', { 
          category: 'linear', 
          symbol: alert.symbol, 
          interval: '60', 
          limit: 24 // 24 свечи по 1 часу = 24 часа
        })
        
        if (klines5m.list && klines1h.list) {
          const recent5mVolume = klines5m.list.slice(-6).reduce((sum, k) => sum + parseFloat(k[5]), 0) // последние 30 минут
          const hour1Volume = klines1h.list.slice(-1).reduce((sum, k) => sum + parseFloat(k[5]), 0) // последний час
          const prevHourVolume = klines1h.list.slice(-2, -1).reduce((sum, k) => sum + parseFloat(k[5]), 0) // предыдущий час
          
          const spikeRatio = prevHourVolume > 0 ? recent5mVolume / prevHourVolume : 0
          const threshold = alert.params?.spikeRatio ?? 5
          
          if (spikeRatio >= threshold) {
            text = `${alert.symbol}: всплеск объема ${spikeRatio.toFixed(1)}x за последние 30 минут!`
          }
        }
      } catch (e) {
        // Игнорируем ошибки при получении данных
      }
    }

    if (text) {
      try {
        await bot.sendMessage(alertsState.telegramChatId, `🔔 ${alert.name}\n${text}`)
        alertsState.lastFired[key] = now
      } catch (err) {}
    }
  }
}

if (BOT_TOKEN) {
  setInterval(checkAlerts, 60 * 1000)
}

app.use('/api/bybit', async (req, res) => {
  const path = req.path.replace(/^\/api\/bybit/, '') || '/'
  const url = BYBIT + path + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')
  try {
    console.log('Proxying to Bybit:', url)
    const r = await fetch(url)
    const body = await r.text()
    // filter problematic headers (transfer-encoding/content-length conflicts)
    const headersObj = {}
    for (const [k, v] of r.headers.entries()) {
      const key = k.toLowerCase()
      if (key === 'transfer-encoding') continue
      // do not forward hop-by-hop headers that may break proxying
      if (['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'upgrade'].includes(key)) continue
      headersObj[k] = v
    }
    res.status(r.status).set(headersObj).send(body)
  } catch (e) {
    console.error('Bybit proxy error:', e)
    res.status(502).json({ error: String(e) })
  }
})

// start HTTP server and attach WebSocket server for realtime kline relay
import http from 'http'

const httpServer = http.createServer(app)

httpServer.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Another server may be running.`)
    // exit process so watcher can restart or user can free the port
    process.exit(1)
  }
  console.error('HTTP server error:', err)
})

httpServer.listen(PORT, () => {
  console.log(`Server http://localhost:${PORT}`)
  if (!BOT_TOKEN) console.log('TELEGRAM_BOT_TOKEN не задан — оповещения в Telegram отключены')
})

const wss = new WebSocketServer({ server: httpServer })

// Graceful shutdown handlers
process.on('SIGINT', () => {
  console.log('Shutting down...')
  try { wss.close() } catch (e) {}
  try { httpServer.close(() => process.exit(0)) } catch (e) { process.exit(0) }
})

// subscriptions: key = `${symbol}:${interval}` -> { clients: Set(ws), timer }
const subscriptions = new Map()

// --- Bybit integration: prefer REST polling over WebSocket in development ---
// You can re-enable Bybit WS by unsetting DISABLE_BYBIT_WS
const BYBIT_WS_URL = process.env.BYBIT_WS_URL || 'wss://stream.bybit.com/v5/public/spot'
const BYBIT_WS_ENABLED = !(process.env.DISABLE_BYBIT_WS === 'true')
let bybitWs = null
let bybitConnected = false
const bybitPendingSubs = new Set()

if (BYBIT_WS_ENABLED) {
  // legacy WS relay (kept for compatibility) — will attempt to connect if enabled
  function initBybitWs() {
    if (bybitWs) return
    try { bybitWs = new WebSocket(BYBIT_WS_URL) } catch (e) { console.error('Failed to create Bybit WS:', e); bybitWs = null; return }

    bybitWs.on('open', () => {
      bybitConnected = true
      console.log('Connected to Bybit WS', BYBIT_WS_URL)
      for (const topic of bybitPendingSubs) {
        try { bybitWs.send(JSON.stringify({ op: 'subscribe', args: [topic] })) } catch (e) {}
      }
    })

    bybitWs.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw.toString()) } catch (e) { return }
      const topic = msg.topic || (msg.arg && msg.arg.topic) || (msg.arg && msg.arg.channel)
      const data = msg.data || msg.payload || null
      if (!topic || !topic.startsWith('kline')) return
      const parts = topic.split('.')
      const interval = parts[1]
      const symbol = parts[2]
      let entry = Array.isArray(data) ? data[0] : (data && typeof data === 'object' ? data : null)
      if (!entry) return

      let t = entry[0] ?? entry.start ?? entry.ts ?? entry.StartTime ?? entry.s ?? null
      let o = entry[1] ?? entry.open ?? entry.O ?? null
      let h = entry[2] ?? entry.high ?? entry.H ?? null
      let l = entry[3] ?? entry.low ?? entry.L ?? null
      let cl = entry[4] ?? entry.close ?? entry.C ?? null
      let vol = entry[5] ?? entry.volume ?? entry.V ?? 0
      let turnover = entry[6] ?? entry.turnover ?? 0

      if (typeof t === 'string') t = parseInt(t, 10)
      if (t && t > 1e12) t = Math.floor(t / 1000)
      if (t && t <= 1e12) t = Math.floor(t)

      const candle = { time: t, open: parseFloat(o) || 0, high: parseFloat(h) || 0, low: parseFloat(l) || 0, close: parseFloat(cl) || 0, volume: parseFloat(vol) || 0, turnover: parseFloat(turnover) || 0 }

      const key = makeKey(symbol, interval)
      const state = subscriptions.get(key)
      if (!state) return
      const msgOut = JSON.stringify({ type: 'kline', symbol, interval, candle })
      for (const ws of state.clients) if (ws.readyState === WebSocket.OPEN) ws.send(msgOut)
    })

    bybitWs.on('close', () => { bybitConnected = false; console.log('Bybit WS closed, will attempt reconnect in 2s'); bybitWs = null; setTimeout(initBybitWs, 2000) })
    bybitWs.on('error', (err) => { console.error('Bybit WS error:', err); try { bybitWs.close() } catch (e) {}; bybitWs = null; bybitConnected = false; setTimeout(initBybitWs, 2000) })
  }

  function subscribeBybitTopic(topic) { initBybitWs(); bybitPendingSubs.add(topic); if (bybitConnected && bybitWs) { try { bybitWs.send(JSON.stringify({ op: 'subscribe', args: [topic] })) } catch (e) { console.error('Bybit subscribe failed', e) } } }
  function unsubscribeBybitTopic(topic) { bybitPendingSubs.delete(topic); if (bybitConnected && bybitWs) { try { bybitWs.send(JSON.stringify({ op: 'unsubscribe', args: [topic] })) } catch (e) { console.error('Bybit unsubscribe failed', e) } } }

  // initialize bybit ws client eagerly
  initBybitWs()
} else {
  // WS disabled — use REST polling only; subscribe/unsubscribe are no-ops
  function subscribeBybitTopic(topic) { /* no-op */ }
  function unsubscribeBybitTopic(topic) { /* no-op */ }
  console.log('DISABLE_BYBIT_WS=true — Bybit WebSocket disabled, using REST polling only')
}

function makeKey(symbol, interval) {
  return `${symbol}:${interval}`
}

async function fetchLatestCandle(symbol, interval) {
  try {
    const res = await bybit('/market/kline', { category: 'linear', symbol, interval, limit: '3' })
    const list = res.list || []
    if (!list.length) return null
    const last = list[list.length - 1]
    const [t, o, h, l, cl, vol, turnover] = last
    return {
      time: Math.floor(parseInt(t, 10) / 1000),
      open: parseFloat(o),
      high: parseFloat(h),
      low: parseFloat(l),
      close: parseFloat(cl),
      volume: parseFloat(vol) || 0,
      turnover: parseFloat(turnover) || 0,
    }
  } catch (e) {
    return null
  }
}

function startSubscription(symbol, interval) {
  const key = makeKey(symbol, interval)
  if (subscriptions.has(key)) return
  const state = { clients: new Set(), timer: null, lastTime: 0, lastSent: null }
  subscriptions.set(key, state)
  // subscribe to Bybit WS topic for this symbol/interval
  const topic = `kline.${interval}.${symbol}`
  try { subscribeBybitTopic(topic) } catch (e) { console.error('subscribeBybitTopic error', e) }

  const tick = async () => {
    const candle = await fetchLatestCandle(symbol, interval)
    if (!candle) return
    // send update when candle has changed (including current incomplete candle)
    const prev = state.lastSent
    const changed = !prev || prev.time !== candle.time || prev.open !== candle.open || prev.high !== candle.high || prev.low !== candle.low || prev.close !== candle.close || prev.volume !== candle.volume
    if (!changed) return
    state.lastTime = candle.time
    state.lastSent = candle
    const msg = JSON.stringify({ type: 'kline', symbol, interval, candle })
    for (const ws of state.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg)
    }
  }

  // initial fetch and then poll every 1s
  tick()
  state.timer = setInterval(tick, 1000)
}

function stopSubscriptionIfIdle(symbol, interval) {
  const key = makeKey(symbol, interval)
  const state = subscriptions.get(key)
  if (!state) return
  if (state.clients.size === 0) {
    clearInterval(state.timer)
    // unsubscribe from Bybit WS topic
    const topic = `kline.${interval}.${symbol}`
    try { unsubscribeBybitTopic(topic) } catch (e) { console.error('unsubscribeBybitTopic error', e) }
    subscriptions.delete(key)
  }
}

wss.on('connection', (ws) => {
  ws.subscriptions = new Set()

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch (e) { return }
    if (msg && msg.type === 'subscribe' && msg.symbol && msg.interval) {
      const key = makeKey(msg.symbol, msg.interval)
      let state = subscriptions.get(key)
      if (!state) startSubscription(msg.symbol, msg.interval)
      state = subscriptions.get(key)
      state.clients.add(ws)
      ws.subscriptions.add(key)
    }
    if (msg && msg.type === 'unsubscribe' && msg.symbol && msg.interval) {
      const key = makeKey(msg.symbol, msg.interval)
      const state = subscriptions.get(key)
      if (state) state.clients.delete(ws)
      ws.subscriptions.delete(key)
      stopSubscriptionIfIdle(msg.symbol, msg.interval)
    }
  })

  ws.on('close', () => {
    // remove ws from any subscriptions
    for (const key of ws.subscriptions) {
      const state = subscriptions.get(key)
      if (state) state.clients.delete(ws)
      const [symbol, interval] = key.split(':')
      stopSubscriptionIfIdle(symbol, interval)
    }
  })
})
