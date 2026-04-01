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
import LoadDistribution from './LoadDistribution'
import LoadSharingPanel from './LoadSharingPanel'
import { fetchStatus, sendSwitch, sendMode, sendCutoff, sendRelay, getMockStatus, getBaseUrl, setBaseUrl } from '@/lib/api'

const POLL_INTERVAL = 3000
const MAX_HISTORY = 40

function ts() {
  return new Date().toLocaleTimeString()
}

function makeAlert(type, message) {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, message, time: ts() }
}

// ─── Scenario definitions (demo mode only) ─────────────────────────────────
function applyScenario(id, base) {
  switch (id) {
    case 'normal':
      return { ...base }

    case 'ps1_fault':
      return {
        ...base,
        ps1: { ...base.ps1, voltage: 0, current: 0, power: 0, frequency: 0, pf: 0, energy: base.ps1.energy, alarm: false },
        ps2: {
          sensor_connected: true,
          error: null,
          voltage: parseFloat((226 + Math.random() * 5).toFixed(1)),
          current: parseFloat((8 + Math.random() * 4).toFixed(2)),
          power: parseFloat((226 * 10 * 0.96).toFixed(1)),
          energy: parseFloat((1240 + Math.random() * 10).toFixed(0)),
          frequency: parseFloat((49.8 + Math.random() * 0.3).toFixed(1)),
          pf: parseFloat((0.94 + Math.random() * 0.04).toFixed(2)),
          alarm: false,
        },
        active_source: 2,
        relays: { ...base.relays, ps1_l: false, ps1_n: false, ps2_l: true, ps2_n: true },
      }

    case 'high_load':
      return {
        ...base,
        ps1: { ...base.ps1, current: 19.8, power: 4550, alarm: true },
      }

    case 'overload_cutoff':
      return {
        ...base,
        ps1: { ...base.ps1, current: 0, power: 0, alarm: true },
        relays: { ...base.relays, ps1_cut: true },
        cutoff: { ...base.cutoff, ps1: true },
      }

    case 'manual_switch':
      return {
        ...base,
        active_source: 2,
        mode: 'manual',
        relays: { ...base.relays, ps1_l: false, ps1_n: false, ps2_l: true, ps2_n: true },
        ps2: {
          sensor_connected: true,
          error: null,
          voltage: parseFloat((230 + Math.random() * 4).toFixed(1)),
          current: parseFloat((7 + Math.random() * 3).toFixed(2)),
          power: parseFloat((230 * 8.5 * 0.95).toFixed(1)),
          energy: parseFloat((870 + Math.random() * 10).toFixed(0)),
          frequency: parseFloat((50.0 + Math.random() * 0.2).toFixed(1)),
          pf: parseFloat((0.93 + Math.random() * 0.05).toFixed(2)),
          alarm: false,
        },
      }

    case 'ps1_restore':
      return {
        ...base,
        active_source: 1,
        relays: { ...base.relays, ps1_l: true, ps1_n: true, ps2_l: false, ps2_n: false },
      }

    case 'load_sharing':
      return {
        ...base,
        ps1: { ...base.ps1, current: 14.2, power: 3200, alarm: false },
        ps2: {
          sensor_connected: true,
          error: null,
          voltage: parseFloat((229 + Math.random() * 4).toFixed(1)),
          current: parseFloat((3 + Math.random() * 2).toFixed(2)),
          power: parseFloat((700 + Math.random() * 100).toFixed(1)),
          energy: parseFloat((310 + Math.random() * 10).toFixed(0)),
          frequency: parseFloat((50.0 + Math.random() * 0.2).toFixed(1)),
          pf: parseFloat((0.94 + Math.random() * 0.04).toFixed(2)),
          alarm: false,
        },
        active_source: 1,
        relays: { ...base.relays, ps1_l: true, ps1_n: true, ps2_l: true, ps2_n: true },
      }

    case 'deploy_dtr':
      return {
        ...base,
        ps1: { ...base.ps1, current: 15.5, power: 3500, alarm: true },
        ps2: {
          sensor_connected: true,
          error: null,
          voltage: parseFloat((228 + Math.random() * 4).toFixed(1)),
          current: parseFloat((12.2 + Math.random() * 1).toFixed(2)),
          power: parseFloat((2800 + Math.random() * 50).toFixed(1)),
          energy: parseFloat((2100 + Math.random() * 10).toFixed(0)),
          frequency: parseFloat((49.8 + Math.random() * 0.3).toFixed(1)),
          pf: parseFloat((0.95 + Math.random() * 0.03).toFixed(2)),
          alarm: true,
        },
        active_source: 1,
        relays: { ...base.relays, ps1_l: true, ps1_n: true, ps2_l: true, ps2_n: true },
      }

    default:
      return base
  }
}

const SCENARIO_ALERTS = {
  normal:          { type: 'success', message: 'Normal operation — PS1 is active and stable.' },
  ps1_fault:       { type: 'error',   message: 'PS1 fault detected! Auto-switched to PS2.' },
  high_load:       { type: 'warning', message: 'High load warning — current nearing overload threshold on PS1.' },
  overload_cutoff: { type: 'error',   message: 'Overload! PS1 cutoff relay R5 activated — power disconnected.' },
  manual_switch:   { type: 'info',    message: 'Operator manually switched load to PS2.' },
  ps1_restore:     { type: 'success', message: 'PS1 restored — load switched back from PS2.' },
  load_sharing:    { type: 'warning', message: 'PS1 at 3200W — exceeds threshold! Overflow shared to PS2.' },
  deploy_dtr:      { type: 'error',   message: '🚨 DEPLOY DTR! Combined load exceeds total capacity. Emergency transformer required!' },
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [alerts, setAlerts] = useState([])
  // Voltage history
  const [ps1VHistory, setPs1VHistory] = useState([])
  const [ps2VHistory, setPs2VHistory] = useState([])
  // Load (power) history
  const [ps1PHistory, setPs1PHistory] = useState([])
  const [ps2PHistory, setPs2PHistory] = useState([])

  const [flaskConnected, setFlaskConnected] = useState(false)
  const [demoMode, setDemoMode] = useState(true)
  const [activeScenario, setActiveScenario] = useState('normal')
  const [switching, setSwitching] = useState(false)
  const [rpiUrl, setRpiUrl] = useState(getBaseUrl())

  // Load sharing thresholds (user-configurable)
  const [ps1Threshold, setPs1Threshold] = useState(2500)
  const [ps2Threshold, setPs2Threshold] = useState(2500)

  const scenarioRef = useRef('normal')
  const prevOverloadRef = useRef({ ps1: false, ps2: false })
  const prevDtrRef = useRef(false)
  const dtrCutoffRef = useRef(false)  // true = DTR auto-cutoff is active, suppress false 'cleared'
  const ps1OverloadCutoffRef = useRef(false)  // true = PS1 overload cutoff pending/active — suppresses re-trigger
  const ps1CutoffActiveRef = useRef(false)    // true = PS1 intentionally cut — suppresses sensor/cutoff alerts
  const ps1OverloadTimerRef = useRef(null)    // holds the 2-second cutoff timeout
  const [ps1OverloadPrompt, setPs1OverloadPrompt] = useState(null)  // { ps2Available } or null

  const addAlert = useCallback((type, message) => {
    setAlerts((prev) => [...prev.slice(-49), makeAlert(type, message)])
  }, [])

  // ─── Handle URL change ──────────────────────────────────────────────────────
  function handleUrlChange(url) {
    setBaseUrl(url)
    setRpiUrl(getBaseUrl())
    setFlaskConnected(false) // reset connection — will retry on next poll
    addAlert('info', `RPi address changed to ${getBaseUrl()}`)
  }

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
          if (prev) {
            // Detect source switch
            if (prev.active_source !== data.active_source) {
              addAlert('info', `Source switched: PS${prev.active_source} → PS${data.active_source}`)
            }
            // Detect cutoff events
            if (!prev.cutoff?.ps1 && data.cutoff?.ps1) {
              // Suppress if we triggered this cutoff ourselves (overload auto-cut)
              if (!ps1CutoffActiveRef.current) {
                addAlert('error', 'PS1 cutoff activated — overload protection triggered!')
              }
            }
            if (prev.cutoff?.ps1 && !data.cutoff?.ps1) {
              addAlert('success', 'PS1 cutoff restored — power line reconnected.')
            }
            if (!prev.cutoff?.ps2 && data.cutoff?.ps2) {
              addAlert('error', 'PS2 cutoff activated — overload protection triggered!')
            }
            if (prev.cutoff?.ps2 && !data.cutoff?.ps2) {
              addAlert('success', 'PS2 cutoff restored — power line reconnected.')
            }
            // Detect sensor connect/disconnect
            if (prev.ps1?.sensor_connected && !data.ps1?.sensor_connected) {
              // Suppress if PS1 is intentionally cut (PZEM loses power when R5 opens)
              if (!ps1CutoffActiveRef.current) {
                addAlert('warning', `PS1 sensor disconnected${data.ps1?.error ? ': ' + data.ps1.error : ''}`)
              }
            }
            if (!prev.ps1?.sensor_connected && data.ps1?.sensor_connected) {
              addAlert('success', 'PS1 sensor connected — readings available.')
            }
            if (prev.ps2?.sensor_connected && !data.ps2?.sensor_connected) {
              addAlert('warning', `PS2 sensor disconnected${data.ps2?.error ? ': ' + data.ps2.error : ''}`)
            }
            if (!prev.ps2?.sensor_connected && data.ps2?.sensor_connected) {
              addAlert('success', 'PS2 sensor connected — readings available.')
            }
          }
          return data
        })

        // History — track voltage and power for both sources
        const now = new Date().toLocaleTimeString()
        if (data.ps1?.sensor_connected) {
          if (data.ps1.voltage) {
            setPs1VHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), { value: data.ps1.voltage, time: now }])
          }
          if (data.ps1.power != null) {
            setPs1PHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), { value: data.ps1.power, time: now }])
          }
        }
        if (data.ps2?.sensor_connected) {
          if (data.ps2.voltage) {
            setPs2VHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), { value: data.ps2.voltage, time: now }])
          }
          if (data.ps2.power != null) {
            setPs2PHistory((h) => [...h.slice(-(MAX_HISTORY - 1)), { value: data.ps2.power, time: now }])
          }
        }
        // ─── Overload detection for load sharing ────────────────────────
        const p1 = data.ps1?.power ?? 0
        const p2 = data.ps2?.power ?? 0
        // PS2 effective load = 1W base + PS1 overflow
        const ps1Over = Math.max(0, p1 - ps1Threshold)
        const ps2Effective = 1 + ps1Over
        const wasPs1Over = prevOverloadRef.current.ps1
        const wasPs2Over = prevOverloadRef.current.ps2
        const isPs1Over = p1 > ps1Threshold
        const isPs2Over = ps2Effective > ps2Threshold

        if (isPs1Over && !wasPs1Over && !ps1OverloadCutoffRef.current) {
          const ps2Available = Math.max(0, ps2Threshold - p2)
          addAlert('warning',
            `⚡ PS1 overloaded! ${p1.toFixed(0)}W exceeds ${ps1Threshold}W threshold. Cutting PS1 power in 2 seconds…`
          )
          ps1OverloadCutoffRef.current = true
          ps1OverloadTimerRef.current = setTimeout(() => {
            ps1CutoffActiveRef.current = true  // mark PS1 as intentionally cut — suppress sensor/cutoff alerts
            // Cut PS1: turn off changeover relays R1/R2, then cut R5
            if (!demoMode) {
              sendRelay('R1', false).catch(() => {})
              sendRelay('R2', false).catch(() => {})
              sendCutoff(1, true).catch(() => {})
            } else {
              setStatus((prev) => prev ? ({
                ...prev,
                relays: { ...prev.relays, ps1_l: false, ps1_n: false },
                cutoff: { ...prev.cutoff, ps1: true },
              }) : prev)
            }
            addAlert('error', '🔴 PS1 load exceeds threshold — socket and bulb stopped.')
            setPs1OverloadPrompt({ ps2Available })
          }, 2000)
        }
        if (!isPs1Over && wasPs1Over) {
          // Only show "load back" if this wasn't caused by our own cutoff (power dropping to 0 after R5 cut)
          if (!ps1OverloadCutoffRef.current) {
            addAlert('success', 'PS1 load back within threshold.')
          }
          // Cancel pending cutoff only if load genuinely recovered before the 2s timer fired
          if (ps1OverloadTimerRef.current) {
            clearTimeout(ps1OverloadTimerRef.current)
            ps1OverloadTimerRef.current = null
            ps1OverloadCutoffRef.current = false
            ps1CutoffActiveRef.current = false
          }
        }
        if (isPs2Over && !wasPs2Over) {
          addAlert('warning',
            `⚡ PS2 effective load ${ps2Effective.toFixed(0)}W (1W + ${ps1Over.toFixed(0)}W overflow) exceeds ${ps2Threshold}W threshold!`
          )
        }
        if (!isPs2Over && wasPs2Over) {
          addAlert('success', 'PS2 effective load back within threshold.')
        }
        prevOverloadRef.current = { ps1: isPs1Over, ps2: isPs2Over }

        // ─── DTR detection: combined load exceeds total capacity ────────
        const totalLoad = p1 + p2
        const totalCapacity = ps1Threshold + ps2Threshold
        const isDtr = totalLoad > totalCapacity

        if (isDtr && !prevDtrRef.current && !dtrCutoffRef.current) {
          const deficit = totalLoad - totalCapacity
          addAlert('error',
            `🚨 DEPLOY DTR! Combined load ${totalLoad.toFixed(0)}W exceeds total capacity ${totalCapacity}W. Deficit: ${deficit.toFixed(0)}W. Deploy Temporary Transformer immediately!`
          )
          // ── EMERGENCY: cut both power sources ──
          addAlert('error',
            '🔴 EMERGENCY CUTOFF: Both PS1 & PS2 power lines disconnected — all sockets and bulbs stopped.'
          )
          dtrCutoffRef.current = true
          handleCutoff(1, true)   // cut PS1 (relay R5)
          handleCutoff(2, true)   // cut PS2 (relay R6)
          // Stop all sockets and bulbs on both PS1 and PS2 (changeover relays R1-R4)
          if (!demoMode) {
            sendRelay('R1', false).catch(() => {})
            sendRelay('R2', false).catch(() => {})
            sendRelay('R3', false).catch(() => {})
            sendRelay('R4', false).catch(() => {})
          } else {
            setStatus((prev) => ({
              ...prev,
              relays: { ...prev.relays, ps1_l: false, ps1_n: false, ps2_l: false, ps2_n: false },
            }))
          }
        }

        // Only show 'DTR cleared' if it was NOT an auto-cutoff (user manually restored)
        if (!isDtr && prevDtrRef.current && !dtrCutoffRef.current) {
          addAlert('success', 'DTR emergency cleared — combined load back within total capacity.')
        }
        prevDtrRef.current = isDtr
      } catch {
        setFlaskConnected(false)
        if (!demoMode) addAlert('error', 'Lost connection to Flask server.')
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => { mounted = false; clearInterval(id); clearTimeout(ps1OverloadTimerRef.current) }
  }, [demoMode, rpiUrl, ps1Threshold, ps2Threshold, addAlert])

  // ─── Scenario trigger (demo only) ──────────────────────────────────────────
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
        setStatus((prev) => ({
          ...prev,
          active_source: source,
          relays: {
            ...prev.relays,
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

  async function handlePs1OverloadOkay() {
    setPs1OverloadPrompt(null)
    // Do NOT reset ps1OverloadCutoffRef here — keeping it true prevents the poll loop from
    // re-detecting the (now 0W) PS1 as "recovered" and then re-arming, which would let a
    // stale reading trigger the 2-second cut timer again and turn the relay off.
    // It will be cleared when the operator explicitly restores PS1 via handleCutoff(1, false).
    try {
      if (!demoMode) {
        // Energize R1+R2 (NO path: PS2 feeds PS1 load side) — switch_to_source(2) handles this
        await sendSwitch(2)
      } else {
        // Switch to PS2: R1/R2 energize (NO path) so PS2 feeds PS1's socket+bulb
        setStatus((prev) => prev ? ({
          ...prev,
          active_source: 2,
          relays: { ...prev.relays, ps1_l: true, ps1_n: true, ps2_l: false, ps2_n: false },
        }) : prev)
      }
      addAlert('info', '⚡ Load sharing from PS2 — socket and bulb now powered from Both ps1 and PS2.')
    } catch {
      addAlert('error', 'Failed to switch to PS2.')
    }
  }

  async function handleCutoff(source, cut) {
    try {
      if (!demoMode) {
        await sendCutoff(source, cut)
      } else {
        setStatus((prev) => ({
          ...prev,
          relays: {
            ...prev.relays,
            [source === 1 ? 'ps1_cut' : 'ps2_cut']: cut,
          },
          cutoff: {
            ...prev.cutoff,
            [source === 1 ? 'ps1' : 'ps2']: cut,
          },
        }))
      }

      // If user is restoring PS1, clear the overload cutoff locks so detection re-arms
      if (!cut && source === 1 && ps1OverloadCutoffRef.current) {
        ps1OverloadCutoffRef.current = false
        ps1CutoffActiveRef.current = false
        setPs1OverloadPrompt(null)
      }

      // If user is restoring power, clear the DTR auto-cutoff lock
      if (!cut && dtrCutoffRef.current) {
        dtrCutoffRef.current = false
        prevDtrRef.current = false  // re-arm DTR detection from fresh
        addAlert('info', 'DTR emergency cutoff released — DTR detection re-armed.')
      }

      addAlert(
        cut ? 'warning' : 'success',
        `PS${source} power line ${cut ? 'CUT — disconnected' : 'RESTORED — reconnected'}.`,
      )
    } catch {
      addAlert('error', `Failed to ${cut ? 'cut' : 'restore'} PS${source}.`)
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

  const ps1Overloaded = status.ps1?.power > 4000
  const ps2Overloaded = status.ps2?.power > 4000

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      <Header
        flaskConnected={flaskConnected}
        demoMode={demoMode}
        onDemoToggle={() => setDemoMode((d) => !d)}
        rpiUrl={rpiUrl}
        onUrlChange={handleUrlChange}
      />

      <main className="flex-1 p-4 lg:p-6 grid gap-4" style={{ gridTemplateColumns: '1fr' }}>

        {/* Row 1: Power source cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PowerSourceCard
            id={1} data={status.ps1}
            isActive={status.active_source === 1}
            isOverloaded={ps1Overloaded}
            isCutoff={status.cutoff?.ps1}
          />
          <PowerSourceCard
            id={2} data={status.ps2}
            isActive={status.active_source === 2}
            isOverloaded={ps2Overloaded}
            isCutoff={status.cutoff?.ps2}
          />
        </div>

        {/* PS1 Overload — OK to transfer load to PS2 */}
        {ps1OverloadPrompt && (
          <div className="border border-orange-500 bg-orange-950/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">⚡</span>
              <div>
                <p className="text-orange-400 font-bold text-sm">PS1 Overload — now power from both ps1 and ps2</p>
                <p className="text-zinc-300 text-sm mt-0.5">PS1 socket and bulb are stopped.</p>
                <p className="text-green-400 text-sm font-medium mt-1">
                  PS2 has <span className="font-bold text-green-300">{ps1OverloadPrompt.ps2Available.toFixed(0)}W</span> available — ready to take the load.
                </p>
              </div>
            </div>
            <button
              onClick={handlePs1OverloadOkay}
              className="bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors shrink-0"
            >
              OK — Switch to PS2
            </button>
          </div>
        )}

        {/* Row 2: Load Sharing (automatic mode) */}
        <LoadSharingPanel
          ps1Power={status.ps1?.power}
          ps2Power={status.ps2?.power}
          ps1Threshold={ps1Threshold}
          ps2Threshold={ps2Threshold}
          onPs1ThresholdChange={setPs1Threshold}
          onPs2ThresholdChange={setPs2Threshold}
          ps1SensorOk={status.ps1?.sensor_connected}
          ps2SensorOk={status.ps2?.sensor_connected}
        />

        {/* Row 3: Load Distribution */}
        <LoadDistribution
          ps1={status.ps1} ps2={status.ps2}
          activeSource={status.active_source}
          cutoff={status.cutoff}
        />

        {/* Row 3: Relay panel (full width) */}
        <RelayPanel relays={status.relays} cutoff={status.cutoff} />

        {/* Row 4: Voltage Charts — PS1 and PS2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveChart
            history={ps1VHistory}
            label="PS1 Voltage"
            unit="V"
            color="#3b82f6"
            min={210}
            max={250}
          />
          <LiveChart
            history={ps2VHistory}
            label="PS2 Voltage"
            unit="V"
            color="#8b5cf6"
            min={210}
            max={250}
          />
        </div>

        {/* Row 5: Load (Power) Charts — PS1 and PS2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveChart
            history={ps1PHistory}
            label="PS1 Load"
            unit="W"
            color="#22c55e"
            min={0}
            max={5000}
          />
          <LiveChart
            history={ps2PHistory}
            label="PS2 Load"
            unit="W"
            color="#a855f7"
            min={0}
            max={5000}
          />
        </div>

        {/* Row 6: Controls */}
        <ControlPanel
          activeSource={status.active_source}
          mode={status.mode}
          onSwitch={handleSwitch}
          onModeChange={handleModeChange}
          onCutoff={handleCutoff}
          cutoff={status.cutoff}
          switching={switching}
        />

        {/* Row 7: Alerts + Scenarios (scenarios only in demo mode) */}
        <div className={`grid grid-cols-1 ${demoMode ? 'lg:grid-cols-2' : ''} gap-4`}>
          <AlertFeed alerts={alerts} />
          {demoMode && (
            <ScenarioPanel onScenario={handleScenario} activeScenario={activeScenario} />
          )}
        </div>

        {/* Row 8: Circuit diagram */}
        <CircuitDiagram
          relays={status.relays}
          activeSource={status.active_source}
          cutoff={status.cutoff}
        />

      </main>
    </div>
  )
}
