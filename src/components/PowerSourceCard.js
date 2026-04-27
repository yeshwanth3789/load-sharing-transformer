'use client'

function Metric({ label, value, unit, warn }) {
  return (
    <div className="flex flex-col gap-1 bg-zinc-800/60 rounded-lg px-3 py-2.5 border border-zinc-700/30">
      <span className="text-zinc-500 text-[10px] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-mono font-bold tabular-nums ${warn ? 'text-amber-400' : 'text-white'}`}>
          {value ?? '—'}
        </span>
        {value != null && <span className="text-zinc-500 text-[10px]">{unit}</span>}
      </div>
    </div>
  )
}

const ALERT_STYLES = {
  info:    { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'ℹ' },
  warning: { text: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: '⚠' },
  error:   { text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: '✕' },
  success: { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: '✓' },
}

function MiniAlerts({ alerts }) {
  if (!alerts?.length) return null
  const recent = [...alerts].slice(-3).reverse()
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-zinc-600 text-[10px] uppercase tracking-wider">Recent Events</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
        {recent.map(alert => {
          const c = ALERT_STYLES[alert.type] || ALERT_STYLES.info
          return (
            <div key={alert.id} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md border ${c.bg} ${c.border}`}>
              <span className={`text-[11px] font-bold ${c.text} shrink-0 mt-px leading-tight`}>{c.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs leading-snug ${c.text}`}>{alert.message}</p>
                <p className="text-zinc-600 text-[10px] mt-0.5">{alert.time}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PowerSourceCard({ id, data, isActive, isOverloaded, isCutoff, isSharing, sharingW, alerts }) {
  const sensorOff = !data.sensor_connected
  const hasError = sensorOff && data.error

  let cfg = { border: 'border-zinc-800',   bg: '',                  dot: 'bg-zinc-600',                                      label: 'Standby',       color: 'text-zinc-500',  iconBg: 'bg-zinc-800' }

  if (isCutoff) {
    cfg = { border: 'border-red-700',     bg: 'bg-red-950/20',     dot: 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]',  label: 'No Output',     color: 'text-red-400',   iconBg: 'bg-red-900/50' }
  } else if (isSharing) {
    cfg = { border: 'border-amber-500',   bg: 'bg-amber-950/20',   dot: 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]',label: 'Sharing Load',  color: 'text-amber-400', iconBg: 'bg-amber-900/50' }
  } else if (isActive && data.alarm) {
    cfg = { border: 'border-red-600',     bg: 'bg-red-950/20',     dot: 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]',  label: 'Alarm',         color: 'text-red-400',   iconBg: 'bg-red-900/50' }
  } else if (isActive && isOverloaded) {
    cfg = { border: 'border-amber-500',   bg: 'bg-amber-950/20',   dot: 'bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]',label: 'Overloaded',    color: 'text-amber-400', iconBg: 'bg-amber-900/50' }
  } else if (isActive && !sensorOff) {
    cfg = { border: 'border-blue-600',    bg: 'bg-blue-950/10',    dot: 'bg-blue-400 animate-pulse shadow-[0_0_8px_#60a5fa]', label: 'Active',        color: 'text-blue-400',  iconBg: 'bg-blue-900/50' }
  } else if (sensorOff && hasError) {
    cfg = { border: 'border-orange-700',  bg: 'bg-orange-950/20',  dot: 'bg-orange-500',                                      label: 'Sensor Offline',color: 'text-orange-400',iconBg: 'bg-orange-900/50' }
  } else if (!isActive && data.voltage === 0) {
    cfg = { border: 'border-red-700',     bg: 'bg-red-950/10',     dot: 'bg-red-500',                                         label: 'Fault',         color: 'text-red-400',   iconBg: 'bg-red-900/50' }
  }

  const loadPct = data.power != null ? Math.min(100, (data.power / 5000) * 100) : 0
  const loadBarColor = isCutoff
    ? 'from-red-600 to-red-400'
    : isOverloaded
    ? 'from-amber-500 to-amber-300'
    : loadPct > 60
    ? 'from-blue-600 to-green-400'
    : 'from-blue-600 to-blue-400'

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} bg-zinc-900 p-5 flex flex-col gap-4 transition-all duration-500`}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.iconBg} border ${cfg.border}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={cfg.color}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <div>
            <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">Power Source</span>
            <h2 className="text-white text-2xl font-bold leading-tight">PS{id}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50">
          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>
      </div>

      {/* Cutoff banner */}
      {isCutoff && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-950/50 border border-red-800/50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" className="shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-red-400 text-xs font-bold">Transformer {id} has failed — no output</p>
            <p className="text-zinc-500 text-xs mt-0.5">Cutoff relay {id === 1 ? 'R5' : 'R6'} open · Voltage and current dropped to zero</p>
          </div>
        </div>
      )}

      {/* Sharing banner */}
      {isSharing && !isCutoff && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-950/50 border border-amber-700/50">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5" className="shrink-0 mt-0.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <div>
            <p className="text-amber-400 text-xs font-bold">
              Transformer {id} overloaded — sharing {sharingW}W to Transformer {id === 1 ? 2 : 1}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5">Load exceeds threshold · overflow routed to backup source</p>
          </div>
        </div>
      )}

      {/* Metrics grid */}
      {sensorOff ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          {hasError ? (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-orange-400 text-sm font-semibold text-center">Sensor Offline</p>
              <p className="text-zinc-500 text-xs text-center max-w-55" title={data.error}>{data.error}</p>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <p className="text-zinc-500 text-sm text-center">PZEM sensor not yet installed</p>
              <p className="text-zinc-600 text-xs text-center">Readings will appear once sensor is connected</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Voltage"      value={data.voltage}   unit="V"  />
          <Metric label="Current"      value={data.current}   unit="A"  warn={data.current > 18} />
          <Metric label="Power"        value={data.power}     unit="W"  warn={data.power > 4000} />
          <Metric label="Frequency"    value={data.frequency} unit="Hz" />
          <Metric label="Power Factor" value={data.pf}        unit=""   />
          <Metric label="Energy"       value={data.energy}    unit="Wh" />
        </div>
      )}

      {/* Load bar */}
      {!sensorOff && (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between items-center">
            <span className="text-zinc-500 text-xs">Load</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold tabular-nums ${loadPct > 80 ? 'text-amber-400' : 'text-zinc-300'}`}>
                {data.power != null ? `${Math.round(loadPct)}%` : '—'}
              </span>
              {data.power != null && (
                <span className="text-zinc-600 text-[10px]">{data.power}W / 5000W</span>
              )}
            </div>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-linear-to-r ${loadBarColor} transition-all duration-700`}
              style={{ width: `${loadPct}%` }}
            />
          </div>
          {/* Threshold marker */}
          <div className="relative h-0">
            <div className="absolute top-0 h-2 w-px bg-zinc-500/60 -mt-2" style={{ left: '50%' }} />
          </div>
        </div>
      )}

      {/* Alarm badge */}
      {data.alarm && !isCutoff && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/50 border border-amber-800/50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-amber-400 text-xs font-semibold">Alarm active — approaching overload</span>
        </div>
      )}

      {/* Per-card alert notification strip */}
      <MiniAlerts alerts={alerts} />
    </div>
  )
}
