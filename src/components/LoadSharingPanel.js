'use client'

import { useState, useMemo } from 'react'

/* ═══════════════════════════════════════════════════════════════════════════
   LOAD SHARING PANEL
   ─────────────────
   Lets the user set a max-load threshold per power line.
   When actual load exceeds the threshold, the overflow is automatically
   "shared" to the other source, and the panel shows:
     • Alert: which line overloaded + by how much
     • Visual bars: assigned vs overflow vs available
     • Net load per source after sharing
   ═══════════════════════════════════════════════════════════════════════════ */

function CapacityBar({ label, color, assigned, overflow, threshold, suffix = 'W' }) {
  const total = threshold || 1
  const assignedPct = Math.min(100, (assigned / total) * 100)
  const overflowPct = Math.min(100 - assignedPct, (overflow / total) * 100)
  const availablePct = Math.max(0, 100 - assignedPct - overflowPct)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">{label}</span>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm font-semibold text-white">
            {(assigned + overflow).toFixed(0)}{suffix}
          </span>
          <span className="text-zinc-600 text-xs">/ {threshold}{suffix}</span>
        </div>
      </div>
      <div className="h-3 w-full bg-zinc-800 rounded-full overflow-hidden flex">
        {assigned > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${assignedPct}%`, background: color }}
            title={`Own load: ${assigned.toFixed(0)}${suffix}`}
          />
        )}
        {overflow > 0 && (
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${overflowPct}%`,
              background: `repeating-linear-gradient(45deg, ${color}88, ${color}88 4px, ${color}44 4px, ${color}44 8px)`,
            }}
            title={`Shared from other source: ${overflow.toFixed(0)}${suffix}`}
          />
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
          <span className="text-zinc-500">Own: {assigned.toFixed(0)}{suffix}</span>
        </div>
        {overflow > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm"
              style={{ background: `repeating-linear-gradient(45deg, ${color}88, ${color}88 2px, ${color}44 2px, ${color}44 4px)` }}
            />
            <span className="text-amber-400">Shared: +{overflow.toFixed(0)}{suffix}</span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span className={`font-semibold ${availablePct < 10 ? 'text-red-400' : 'text-emerald-400'}`}>
            Available: {Math.max(0, threshold - assigned - overflow).toFixed(0)}{suffix}
          </span>
        </div>
      </div>
    </div>
  )
}

function OverflowArrow({ fromLabel, toLabel, amount, color }) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span className="text-zinc-500 text-xs font-medium">{fromLabel}</span>
      <div className="flex items-center gap-1">
        <div className="h-px w-8 bg-amber-500" />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6h8M7 3l3 3-3 3" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
        <span className="text-amber-400 text-xs font-bold font-mono">{amount.toFixed(0)}W</span>
      </div>
      <div className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6h8M7 3l3 3-3 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="h-px w-8" style={{ background: color }} />
      </div>
      <span className="text-zinc-500 text-xs font-medium">{toLabel}</span>
    </div>
  )
}

export default function LoadSharingPanel({
  ps1Power,
  ps2Power,
  ps1Threshold,
  ps2Threshold,
  onPs1ThresholdChange,
  onPs2ThresholdChange,
  ps1SensorOk,
  ps2SensorOk,
}) {
  // PS2 effective load = 1W base usage + PS1 overflow
  const ps1Overflow = Math.max(0, (ps1Power ?? 0) - ps1Threshold)
  const ps2EffectiveLoad = 1 + ps1Overflow
  const [editPs1, setEditPs1] = useState(false)
  const [editPs2, setEditPs2] = useState(false)
  const [draftPs1, setDraftPs1] = useState(String(ps1Threshold))
  const [draftPs2, setDraftPs2] = useState(String(ps2Threshold))

  // ─── Load sharing computation ────────────────────────────────────────────
  const sharing = useMemo(() => {
    const p1 = ps1Power ?? 0
    const p2 = ps2Power ?? 0
    const t1 = ps1Threshold
    const t2 = ps2Threshold

    let ps1Own = p1       // load staying on PS1
    let ps2Own = p2       // load staying on PS2
    let ps1Shared = 0     // overflow received by PS1 from PS2
    let ps2Shared = 0     // overflow received by PS2 from PS1
    let ps1Overflow = 0   // how much PS1 is over threshold
    let ps2Overflow = 0   // how much PS2 is over threshold
    let alerts = []

    // PS1 overflow → share to PS2
    if (p1 > t1 && ps2SensorOk) {
      ps1Overflow = p1 - t1
      const ps2Headroom = Math.max(0, t2 - p2)
      const canShare = Math.min(ps1Overflow, ps2Headroom)
      ps1Own = t1
      ps2Shared = canShare
      if (ps1Overflow > ps2Headroom) {
        alerts.push({
          type: 'error',
          msg: `PS1 demands ${p1.toFixed(0)}W (limit ${t1}W). Overflow ${ps1Overflow.toFixed(0)}W, but PS2 can only absorb ${ps2Headroom.toFixed(0)}W. ${(ps1Overflow - canShare).toFixed(0)}W UNSERVED!`,
        })
      } else {
        alerts.push({
          type: 'warning',
          msg: `PS1 overloaded! ${p1.toFixed(0)}W exceeds ${t1}W threshold. Sharing ${canShare.toFixed(0)}W to PS2.`,
        })
      }
    } else if (p1 > t1) {
      ps1Overflow = p1 - t1
      alerts.push({
        type: 'error',
        msg: `PS1 overloaded at ${p1.toFixed(0)}W (limit ${t1}W). PS2 sensor offline — cannot share!`,
      })
    }

    // PS2 overflow → share to PS1
    if (p2 > t2 && ps1SensorOk) {
      ps2Overflow = p2 - t2
      const ps1Headroom = Math.max(0, t1 - p1)
      const canShare = Math.min(ps2Overflow, ps1Headroom)
      ps2Own = t2
      ps1Shared = canShare
      if (ps2Overflow > ps1Headroom) {
        alerts.push({
          type: 'error',
          msg: `PS2 demands ${p2.toFixed(0)}W (limit ${t2}W). Overflow ${ps2Overflow.toFixed(0)}W, but PS1 can only absorb ${ps1Headroom.toFixed(0)}W. ${(ps2Overflow - canShare).toFixed(0)}W UNSERVED!`,
        })
      } else {
        alerts.push({
          type: 'warning',
          msg: `PS2 overloaded! ${p2.toFixed(0)}W exceeds ${t2}W threshold. Sharing ${canShare.toFixed(0)}W to PS1.`,
        })
      }
    } else if (p2 > t2) {
      ps2Overflow = p2 - t2
      alerts.push({
        type: 'error',
        msg: `PS2 overloaded at ${p2.toFixed(0)}W (limit ${t2}W). PS1 sensor offline — cannot share!`,
      })
    }

    // ─── DTR detection: combined load exceeds total capacity ──────────
    const totalLoad = p1 + p2
    const totalCapacity = t1 + t2
    const unservedLoad = Math.max(0, totalLoad - totalCapacity)
    const dtrRequired = unservedLoad > 0

    if (dtrRequired) {
      alerts.push({
        type: 'dtr',
        msg: `DEPLOY DTR! Combined load ${totalLoad.toFixed(0)}W exceeds total capacity ${totalCapacity}W. Deficit: ${unservedLoad.toFixed(0)}W unserved. Deploy a Temporary Transformer immediately for smoother power supply.`,
      })
    }

    return {
      ps1Own: Math.min(ps1Own, t1),
      ps2Own: Math.min(ps2Own, t2),
      ps1Shared,
      ps2Shared,
      ps1Overflow,
      ps2Overflow,
      ps1Available: Math.max(0, t1 - Math.min(ps1Own, t1) - ps1Shared),
      ps2Available: Math.max(0, t2 - Math.min(ps2Own, t2) - ps2Shared),
      ps1Net: Math.min(ps1Own, t1) + ps1Shared,
      ps2Net: Math.min(ps2Own, t2) + ps2Shared,
      alerts,
      dtrRequired,
      unservedLoad,
      totalLoad,
      totalCapacity,
    }
  }, [ps1Power, ps2Power, ps1Threshold, ps2Threshold, ps1SensorOk, ps2SensorOk])

  function submitPs1(e) {
    e?.preventDefault()
    const v = parseInt(draftPs1, 10)
    if (v > 0) onPs1ThresholdChange(v)
    setEditPs1(false)
  }

  function submitPs2(e) {
    e?.preventDefault()
    const v = parseInt(draftPs2, 10)
    if (v > 0) onPs2ThresholdChange(v)
    setEditPs2(false)
  }

  const isPs1Over = (ps1Power ?? 0) > ps1Threshold
  const isPs2Over = ps2EffectiveLoad > ps2Threshold

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
        <div>
          <h2 className="text-white text-lg font-bold">Automatic Load Sharing</h2>
          <p className="text-zinc-500 text-xs">
            Set max load per power line. Excess is automatically shared to the other source.
          </p>
        </div>
      </div>

      {/* Threshold settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* PS1 threshold */}
        <div className={`rounded-lg border p-4 transition-colors duration-300 ${
          isPs1Over ? 'border-amber-600 bg-amber-950/20' : 'border-zinc-800 bg-zinc-950'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-white text-sm font-semibold">PS1 Threshold</span>
            </div>
            {editPs1 ? (
              <form onSubmit={submitPs1} className="flex items-center gap-1">
                <input
                  type="number"
                  value={draftPs1}
                  onChange={(e) => setDraftPs1(e.target.value)}
                  className="w-20 px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-white text-sm font-mono text-right outline-none focus:border-blue-500"
                  min={1}
                  autoFocus
                />
                <span className="text-zinc-500 text-xs">W</span>
                <button type="submit" className="ml-1 px-2 py-1 rounded bg-blue-600 text-white text-xs font-semibold">✓</button>
              </form>
            ) : (
              <button
                onClick={() => { setDraftPs1(String(ps1Threshold)); setEditPs1(true) }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <span className="text-white font-mono text-sm font-bold">{ps1Threshold}W</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-500">Current load</span>
            <span className={`font-mono font-semibold ${isPs1Over ? 'text-amber-400' : 'text-white'}`}>
              {(ps1Power ?? 0).toFixed(0)}W
            </span>
          </div>
          {isPs1Over && (
            <div className="text-amber-400 text-xs font-semibold mt-1">
              ⚠ Overloaded by {((ps1Power ?? 0) - ps1Threshold).toFixed(0)}W
            </div>
          )}
        </div>

        {/* PS2 threshold */}
        <div className={`rounded-lg border p-4 transition-colors duration-300 ${
          isPs2Over ? 'border-amber-600 bg-amber-950/20' : 'border-zinc-800 bg-zinc-950'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-white text-sm font-semibold">PS2 Threshold</span>
            </div>
            {editPs2 ? (
              <form onSubmit={submitPs2} className="flex items-center gap-1">
                <input
                  type="number"
                  value={draftPs2}
                  onChange={(e) => setDraftPs2(e.target.value)}
                  className="w-20 px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-white text-sm font-mono text-right outline-none focus:border-purple-500"
                  min={1}
                  autoFocus
                />
                <span className="text-zinc-500 text-xs">W</span>
                <button type="submit" className="ml-1 px-2 py-1 rounded bg-purple-600 text-white text-xs font-semibold">✓</button>
              </form>
            ) : (
              <button
                onClick={() => { setDraftPs2(String(ps2Threshold)); setEditPs2(true) }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <span className="text-white font-mono text-sm font-bold">{ps2Threshold}W</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-500">Effective load</span>
            <span className={`font-mono font-semibold ${isPs2Over ? 'text-amber-400' : 'text-white'}`}>
              {ps2EffectiveLoad.toFixed(0)}W
            </span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-600">├ Base usage</span>
            <span className="font-mono text-zinc-400">1W</span>
          </div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-zinc-600">└ PS1 overflow</span>
            <span className={`font-mono ${ps1Overflow > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
              {ps1Overflow > 0 ? '+' : ''}{ps1Overflow.toFixed(0)}W
            </span>
          </div>
          {isPs2Over && (
            <div className="text-amber-400 text-xs font-semibold mt-1">
              ⚠ Overloaded by {(ps2EffectiveLoad - ps2Threshold).toFixed(0)}W
            </div>
          )}
        </div>
      </div>

      {/* 🚨 DTR Emergency Banner */}
      {sharing.dtrRequired && (
        <div className="relative rounded-xl border-2 border-red-500 bg-red-950/40 p-5 overflow-hidden">
          {/* Animated pulse ring */}
          <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-ping opacity-20" />
          <div className="relative flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center flex-shrink-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-red-400 text-lg font-black uppercase tracking-wide">
                  ⚠ DEPLOY DTR — EMERGENCY
                </h3>
                <p className="text-red-300/80 text-xs">
                  Distribution Temporary Transformer required for smoother power supply
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-red-950/50 border border-red-800/40 p-3 text-center">
                <p className="text-red-400/70 text-[10px] uppercase">Combined Load</p>
                <p className="text-red-300 font-mono text-xl font-black">{sharing.totalLoad.toFixed(0)}<span className="text-red-500 text-xs">W</span></p>
              </div>
              <div className="rounded-lg bg-red-950/50 border border-red-800/40 p-3 text-center">
                <p className="text-red-400/70 text-[10px] uppercase">Total Capacity</p>
                <p className="text-red-300 font-mono text-xl font-black">{sharing.totalCapacity}<span className="text-red-500 text-xs">W</span></p>
              </div>
              <div className="rounded-lg bg-red-600/30 border border-red-500/60 p-3 text-center">
                <p className="text-red-300 text-[10px] uppercase font-bold">Deficit</p>
                <p className="text-white font-mono text-xl font-black">{sharing.unservedLoad.toFixed(0)}<span className="text-red-300 text-xs">W</span></p>
              </div>
            </div>
            <p className="text-red-400/90 text-xs leading-relaxed">
              Both power sources are at full capacity. <strong>{sharing.unservedLoad.toFixed(0)}W</strong> of load
              cannot be served by the existing infrastructure. Deploy a DTR (Distribution Temporary Transformer)
              to bridge the capacity gap and prevent power outages.
            </p>
          </div>
        </div>
      )}

      {/* Sharing alerts */}
      {sharing.alerts.filter(a => a.type !== 'dtr').length > 0 && (
        <div className="flex flex-col gap-2">
          {sharing.alerts.filter(a => a.type !== 'dtr').map((a, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border ${
              a.type === 'error'
                ? 'bg-red-950/30 border-red-800/40'
                : 'bg-amber-950/30 border-amber-800/40'
            }`}>
              <span className="text-lg leading-none mt-0.5">{a.type === 'error' ? '🚨' : '⚡'}</span>
              <span className={`text-xs font-medium ${
                a.type === 'error' ? 'text-red-400' : 'text-amber-400'
              }`}>
                {a.msg}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Overflow arrows */}
      {sharing.ps1Overflow > 0 && sharing.ps2Shared > 0 && (
        <OverflowArrow
          fromLabel="PS1"
          toLabel="PS2"
          amount={sharing.ps2Shared}
          color="#a855f7"
        />
      )}
      {sharing.ps2Overflow > 0 && sharing.ps1Shared > 0 && (
        <OverflowArrow
          fromLabel="PS2"
          toLabel="PS1"
          amount={sharing.ps1Shared}
          color="#3b82f6"
        />
      )}

      {/* Capacity bars after sharing */}
      <div className="flex flex-col gap-4">
        <h3 className="text-zinc-400 text-xs uppercase tracking-widest">Load After Sharing</h3>
        <CapacityBar
          label="Power Source 1"
          color="#3b82f6"
          assigned={sharing.ps1Own}
          overflow={sharing.ps1Shared}
          threshold={ps1Threshold}
        />
        <CapacityBar
          label="Power Source 2"
          color="#a855f7"
          assigned={sharing.ps2Own}
          overflow={sharing.ps2Shared}
          threshold={ps2Threshold}
        />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-center">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide">PS1 Net Load</p>
          <p className="text-white font-mono text-lg font-bold">{sharing.ps1Net.toFixed(0)}<span className="text-zinc-500 text-xs">W</span></p>
        </div>
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-center">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide">PS1 Available</p>
          <p className={`font-mono text-lg font-bold ${sharing.ps1Available < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
            {sharing.ps1Available.toFixed(0)}<span className="text-zinc-500 text-xs">W</span>
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-center">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide">PS2 Net Load</p>
          <p className="text-white font-mono text-lg font-bold">{sharing.ps2Net.toFixed(0)}<span className="text-zinc-500 text-xs">W</span></p>
        </div>
        <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-center">
          <p className="text-zinc-500 text-[10px] uppercase tracking-wide">PS2 Available</p>
          <p className={`font-mono text-lg font-bold ${sharing.ps2Available < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
            {sharing.ps2Available.toFixed(0)}<span className="text-zinc-500 text-xs">W</span>
          </p>
        </div>
      </div>
    </div>
  )
}
