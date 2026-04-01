// Default Flask server base URL
const DEFAULT_URL = 'http://raspberrypi.local:5000'

// Dynamic base URL — can be changed at runtime
let _baseUrl = DEFAULT_URL

export function getBaseUrl() { return _baseUrl }

export function setBaseUrl(url) {
  // Normalize: strip trailing slash, ensure http://
  let u = url.trim()
  if (!u) { _baseUrl = DEFAULT_URL; return }
  if (!/^https?:\/\//.test(u)) u = 'http://' + u
  if (!/:(\d+)/.test(u)) u += ':5000'     // default port
  _baseUrl = u.replace(/\/+$/, '')
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export function getMockStatus() {
  const v = 228 + Math.random() * 6
  const a = 10 + Math.random() * 4
  return {
    ps1: {
      sensor_connected: true,
      error: null,
      voltage: parseFloat(v.toFixed(1)),
      current: parseFloat(a.toFixed(2)),
      power: parseFloat((v * a * 0.97).toFixed(1)),
      energy: parseFloat((4521 + Math.random() * 10).toFixed(0)),
      frequency: parseFloat((49.9 + Math.random() * 0.3).toFixed(1)),
      pf: parseFloat((0.95 + Math.random() * 0.04).toFixed(2)),
      alarm: false,
    },
    ps2: {
      sensor_connected: true,
      error: null,
      voltage: parseFloat((228 + Math.random() * 6).toFixed(1)),
      current: parseFloat((0.004 + Math.random() * 0.002).toFixed(3)),
      power: parseFloat((0.8 + Math.random() * 0.4).toFixed(1)),
      energy: parseFloat((12 + Math.random() * 2).toFixed(0)),
      frequency: parseFloat((49.9 + Math.random() * 0.3).toFixed(1)),
      pf: parseFloat((0.40 + Math.random() * 0.30).toFixed(2)),
      alarm: false,
    },
    active_source: 1,
    mode: 'auto',
    relays: {
      ps1_l: false,
      ps1_n: false,
      ps2_l: false,
      ps2_n: false,
      ps1_cut: false,
      ps2_cut: false,
    },
    cutoff: {
      ps1: false,
      ps2: false,
    },
    timestamp: new Date().toISOString(),
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

/** Health check — GET /api/ping */
export async function pingFlask() {
  const res = await fetch(`${_baseUrl}/api/ping`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) throw new Error('Ping failed')
  return res.json()
}

/** Poll live data — GET /api/status */
export async function fetchStatus() {
  const res = await fetch(`${_baseUrl}/api/status`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  })
  if (!res.ok) throw new Error('Flask unreachable')
  return res.json()
}

/** Switch active source — POST /api/switch */
export async function sendSwitch(source) {
  const res = await fetch(`${_baseUrl}/api/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
  if (!res.ok) throw new Error('Switch command failed')
  return res.json()
}

/** Set switching mode — POST /api/mode */
export async function sendMode(mode) {
  const res = await fetch(`${_baseUrl}/api/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  if (!res.ok) throw new Error('Mode command failed')
  return res.json()
}

/** Cut or restore a power line — POST /api/cutoff */
export async function sendCutoff(source, cut) {
  const res = await fetch(`${_baseUrl}/api/cutoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, cut }),
  })
  if (!res.ok) throw new Error('Cutoff command failed')
  return res.json()
}

/** Direct relay control — POST /api/relay */
export async function sendRelay(relay, on) {
  const res = await fetch(`${_baseUrl}/api/relay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relay, on }),
  })
  if (!res.ok) throw new Error('Relay command failed')
  return res.json()
}

/** Sync load sharing thresholds to server — POST /api/thresholds */
export async function sendThresholds(ps1, ps2) {
  const res = await fetch(`${_baseUrl}/api/thresholds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ps1, ps2 }),
  })
  if (!res.ok) throw new Error('Thresholds command failed')
  return res.json()
}
