'use client'

function Metric({ label, value, unit, warn }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-zinc-500 text-xs uppercase tracking-wide">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-mono font-semibold ${warn ? 'text-amber-400' : 'text-white'}`}>
          {value ?? '—'}
        </span>
        {value != null && <span className="text-zinc-500 text-xs">{unit}</span>}
      </div>
    </div>
  )
}

export default function PowerSourceCard({ id, data, isActive, isOverloaded, isCutoff }) {
  const sensorOff = !data.sensor_connected
  const hasError = sensorOff && data.error

  // --- Determine card style ---
  let borderColor = 'border-zinc-800'
  let statusLabel = 'Standby'
  let statusColor = 'text-zinc-500'
  let dotColor = 'bg-zinc-600'

  if (isCutoff) {
    borderColor = 'border-red-700'
    statusLabel = 'No Output'
    statusColor = 'text-red-400'
    dotColor = 'bg-red-500 animate-pulse'
  } else if (isActive && data.alarm) {
    borderColor = 'border-red-600'
    statusLabel = 'Alarm'
    statusColor = 'text-red-400'
    dotColor = 'bg-red-500 animate-pulse'
  } else if (isActive && isOverloaded) {
    borderColor = 'border-amber-500'
    statusLabel = 'Overloaded'
    statusColor = 'text-amber-400'
    dotColor = 'bg-amber-400 animate-pulse'
  } else if (isActive && !sensorOff) {
    borderColor = 'border-blue-600'
    statusLabel = 'Active'
    statusColor = 'text-blue-400'
    dotColor = 'bg-blue-400 animate-pulse'
  } else if (sensorOff && hasError) {
    borderColor = 'border-orange-700'
    statusLabel = 'Sensor Offline'
    statusColor = 'text-orange-400'
    dotColor = 'bg-orange-500'
  } else if (!isActive && data.voltage === 0) {
    borderColor = 'border-red-700'
    statusLabel = 'Fault'
    statusColor = 'text-red-400'
    dotColor = 'bg-red-500'
  }

  return (
    <div className={`rounded-xl border-2 ${borderColor} bg-zinc-900 p-5 flex flex-col gap-4 transition-colors duration-500`}>
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Power Source</span>
          <h2 className="text-white text-xl font-bold">PS{id}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</span>
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

      {/* Metrics grid — 3 states */}
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
              <p className="text-zinc-500 text-xs text-center max-w-[220px]" title={data.error}>
                {data.error}
              </p>
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
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Voltage" value={data.voltage} unit="V" />
          <Metric label="Current" value={data.current} unit="A" warn={data.current > 18} />
          <Metric label="Power" value={data.power} unit="W" warn={data.power > 4000} />
          <Metric label="Frequency" value={data.frequency} unit="Hz" />
          <Metric label="Power Factor" value={data.pf} unit="" />
          <Metric label="Energy" value={data.energy} unit="Wh" />
        </div>
      )}

      {/* Load bar (only when sensor present) */}
      {!sensorOff && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Load</span>
            <span>{data.power != null ? `${Math.min(100, Math.round((data.power / 5000) * 100))}%` : '—'}</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isCutoff ? 'bg-red-500' : isOverloaded ? 'bg-amber-400' : 'bg-blue-500'
              }`}
              style={{ width: data.power != null ? `${Math.min(100, (data.power / 5000) * 100)}%` : '0%' }}
            />
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
    </div>
  )
}
