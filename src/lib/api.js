// Flask server base URL - update this to match your RPi's IP on the local network
export const FLASK_BASE_URL = 'http://raspberrypi.local:5000'

// ─── Mock data ────────────────────────────────────────────────────────────────

export function getMockStatus() {
  const v = 228 + Math.random() * 6
  const a = 10 + Math.random() * 4
  return {
    ps1: {
      voltage: parseFloat(v.toFixed(1)),
      current: parseFloat(a.toFixed(2)),
      power: parseFloat((v * a * 0.97).toFixed(1)),
      energy: parseFloat((45.2 + Math.random() * 0.1).toFixed(2)),
      frequency: parseFloat((49.9 + Math.random() * 0.3).toFixed(1)),
      pf: parseFloat((0.95 + Math.random() * 0.04).toFixed(2)),
      sensor_connected: true,
    },
    ps2: {
      voltage: null,
      current: null,
      power: null,
      energy: null,
      frequency: null,
      pf: null,
      sensor_connected: false, // PZEM not yet installed on PS2
    },
    active_source: 1,
    relays: { ps1_l: true, ps1_n: true, ps2_l: false, ps2_n: false },
    mode: 'auto',
    timestamp: new Date().toISOString(),
  }
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchStatus() {
  const res = await fetch(`${FLASK_BASE_URL}/api/status`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Flask unreachable')
  return res.json()
}

export async function sendSwitch(source) {
  const res = await fetch(`${FLASK_BASE_URL}/api/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
  if (!res.ok) throw new Error('Switch command failed')
  return res.json()
}

export async function sendMode(mode) {
  const res = await fetch(`${FLASK_BASE_URL}/api/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  if (!res.ok) throw new Error('Mode command failed')
  return res.json()
}
