'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './Header'
import PowerSourceCard from './PowerSourceCard'
import RelayPanel from './RelayPanel'
import ControlPanel from './ControlPanel'
import AlertFeed from './AlertFeed'
import LiveChart from './LiveChart'
import ScenarioPanel from './ScenarioPanel'
import CircuitDiagram from './CircuitDiagram'
import { fetchStatus, sendSwitch, sendMode, getMockStatus } from '@/lib/api'

const POLL_INTERVAL = 3000
const MAX_HISTORY = 40

function ts() {
  return new Date().toLocaleTimeString()
}

let alertCounter = 0
function makeAlert(type, message) {
  return { id: ++alertCounter, type, message, time: ts() }
}

// ─── Scenario definitions ─────────────────────────────────────────────────────
function applyScenario(id, base) {
  switch (id) {
    case 'normal':
      return { ...base }

    case 'ps1_fault':
      return {
        ...base,
        ps1: { ...base.ps1, voltage: 0, current: 0, power: 0, frequency: 0, pf: 0 },
        active_source: 2,
        relays: { ps1_l: false, ps1_n: false, ps2_l: true, ps2_n: true },
      }

    case 'high_load':
      return {
        ...base,
        ps1: { ...base.ps1, current: 19.8, power: 4550 },
      }

    case 'manual_switch':
      return {
        ...base,
        active_source: 2,
        mode: 'manual',
        relays: { ps1_l: false, ps1_n: false, ps2_l: true, ps2_n: true },
        ps2: { ...base.ps2, sensor_connected: false },
      }

    case 'ps1_restore':
      return {
        ...base,
        active_source: 1,
        relays: { ps1_l: true, ps1_n: true, ps2_l: false, ps2_n: false },
      }

    default:
      return base
  }
}

const SCENARIO_ALERTS = {
  normal:        { type: 'success', message: 'Normal operation — PS1 is active and stable.' },
  ps1_fault:     { type: 'error',   message: 'PS1 fault detected! Auto-switched to PS2.' },
  high_load:     { type: 'warning', message: 'High load warning — current nearing overload threshold on PS1.' },
  manual_switch: { type: 'info',    message: 'Operator manually switched load to PS2.' },
  ps1_restore:   { type: 'success', message: 'PS1 restored — load switched back from PS2.' },
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])   // voltage history for chart
  const [flaskConnected, setFlaskConnected] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
  const [activeScenario, setActiveScenario] = useState('normal')
  const [switching, setSwitching] = useState(false)

  const prevActiveRef = useRef(null)
  const scenarioRef = useRef('normal')

  const addAlert = useCallback((type, message) => {
    setAlerts((prev) => [...prev.slice(-49), makeAlert(type, message)])
  }, [])

  // ─── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function poll() {
      if (!mounted) return
      try {
        let data
        if (demoMode) {
          const base = getMockStatus()
          data = applyScenario(scenarioRef.current, base)
          setFlaskConnected(false)
        } else {
          data = await fetchStatus()
          setFlaskConnected(true)
        }

        setStatus((prev) => {
          // Detect source switch event
          if (prev && prev.active_source !== data.active_source) {
            addAlert('info', `Source switched: PS${prev.active_source} → PS${data.active_source}`)
          }
          return data
        })

        // Voltage history
        if (data.ps1.sensor_connected && data.ps1.voltage) {
          setHistory((h) => [
            ...h.slice(-(MAX_HISTORY - 1)),
            { value: data.ps1.voltage, time: new Date().toLocaleTimeString() },
          ])
        }
      } catch {
        setFlaskConnected(false)
        if (!demoMode) addAlert('error', 'Lost connection to Flask server.')
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => { mounted = false; clearInterval(id) }
  }, [demoMode, addAlert])

  // ─── Scenario trigger ───────────────────────────────────────────────────────
  function handleScenario(id) {
    setActiveScenario(id)
    scenarioRef.current = id
    const a = SCENARIO_ALERTS[id]
    if (a) addAlert(a.type, a.message)
  }

  // ─── Controls ───────────────────────────────────────────────────────────────
  async function handleSwitch(source) {
    if (status?.mode !== 'manual') return
    setSwitching(true)
    try {
      if (!demoMode) {
        await sendSwitch(source)
      } else {
        // Simulate relay change in demo
        setStatus((prev) => ({
          ...prev,
          active_source: source,
          relays: {
            ps1_l: source === 1, ps1_n: source === 1,
            ps2_l: source === 2, ps2_n: source === 2,
          },
        }))
      }
      addAlert('info', `Manual switch to PS${source} executed.`)
    } catch {
      addAlert('error', `Failed to switch to PS${source}.`)
    } finally {
      setSwitching(false)
    }
  }

  async function handleModeChange(mode) {
    try {
      if (!demoMode) await sendMode(mode)
      setStatus((prev) => prev ? { ...prev, mode } : prev)
      addAlert('info', `Mode changed to ${mode.toUpperCase()}.`)
    } catch {
      addAlert('error', 'Failed to change mode.')
    }
  }

  if (!status) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-zinc-400 text-sm">Connecting…</span>
        </div>
      </div>
    )
  }

  const isOverloaded = status.ps1.power > 4000

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header
        flaskConnected={flaskConnected}
        demoMode={demoMode}
        onDemoToggle={() => setDemoMode((d) => !d)}
      />

      <main className="flex-1 p-4 lg:p-6 grid gap-4" style={{ gridTemplateColumns: '1fr' }}>

        {/* Row 1: Power source cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PowerSourceCard id={1} data={status.ps1} isActive={status.active_source === 1} isOverloaded={isOverloaded} />
          <PowerSourceCard id={2} data={status.ps2} isActive={status.active_source === 2} isOverloaded={false} />
        </div>

        {/* Row 2: Relay panel (full width) */}
        <RelayPanel relays={status.relays} />

        {/* Row 3: Chart + Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveChart
            history={history}
            label="PS1 Voltage"
            unit="V"
            color="#3b82f6"
            min={210}
            max={250}
          />
          <ControlPanel
            activeSource={status.active_source}
            mode={status.mode}
            onSwitch={handleSwitch}
            onModeChange={handleModeChange}
            switching={switching}
          />
        </div>

        {/* Row 4: Alerts + Scenarios */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AlertFeed alerts={alerts} />
          <ScenarioPanel onScenario={handleScenario} activeScenario={activeScenario} />
        </div>

        {/* Row 5: Circuit diagram */}
        <CircuitDiagram relays={status.relays} activeSource={status.active_source} />

      </main>
    </div>
  )
}
