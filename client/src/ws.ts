type KlineCandle = { time: number; open: number; high: number; low: number; close: number }
type KlineMessage = { type: 'kline'; symbol: string; interval: string; candle: KlineCandle }

type Callback = (candle: KlineCandle) => void

class WSManager {
  private ws: WebSocket | null = null
  private url: string
  private subscribers: Map<string, Set<Callback>> = new Map()
  private reconnectMs = 1000
  private reconnectTimer: number | null = null

  constructor() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.hostname || 'localhost'
    // сервер по умолчанию слушает 4001
    this.url = `${proto}://${host}:4001`
    this.connect()
  }

  private connect() {
    if (this.ws) return
    try {
      this.ws = new WebSocket(this.url)
    } catch (e) {
      this.scheduleReconnect()
      return
    }

    this.ws.addEventListener('open', () => {
      // resubscribe existing keys
      for (const key of this.subscribers.keys()) {
        const [symbol, interval] = key.split(':')
        this.send({ type: 'subscribe', symbol, interval } as any)
      }
      this.reconnectMs = 1000
    })

    this.ws.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(ev.data) as KlineMessage
        if (msg?.type === 'kline') {
          const key = `${msg.symbol}:${msg.interval}`
          const s = this.subscribers.get(key)
          if (s) {
            for (const cb of s) cb(msg.candle)
          }
        }
      } catch (e) {
        // ignore
      }
    })

    this.ws.addEventListener('close', () => {
      this.ws = null
      this.scheduleReconnect()
    })

    this.ws.addEventListener('error', () => {
      try { this.ws?.close() } catch (e) {}
    })
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectMs = Math.min(this.reconnectMs * 1.5, 60_000)
      this.connect()
    }, this.reconnectMs)
  }

  private send(obj: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    try { this.ws.send(JSON.stringify(obj)) } catch (e) {}
  }

  subscribe(symbol: string, interval: string, cb: Callback) {
    const key = `${symbol}:${interval}`
    let set = this.subscribers.get(key)
    if (!set) {
      set = new Set()
      this.subscribers.set(key, set)
      // ask server to start sending
      this.send({ type: 'subscribe', symbol, interval })
    }
    set.add(cb)
  }

  unsubscribe(symbol: string, interval: string, cb: Callback) {
    const key = `${symbol}:${interval}`
    const set = this.subscribers.get(key)
    if (!set) return
    set.delete(cb)
    if (set.size === 0) {
      this.subscribers.delete(key)
      this.send({ type: 'unsubscribe', symbol, interval })
    }
  }
}

const wsManager = new WSManager()
export default wsManager
