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

export default function PowerSourceCard({ id, data, isActive, isOverloaded }) {
  const noSensor = !data.sensor_connected

  let borderColor = 'border-zinc-800'
  let statusLabel = 'Standby'
  let statusColor = 'text-zinc-500'
  let dotColor = 'bg-zinc-600'

  if (isActive && !isOverloaded) {
    borderColor = 'border-blue-600'
    statusLabel = 'Active'
    statusColor = 'text-blue-400'
    dotColor = 'bg-blue-400 animate-pulse'
  } else if (isActive && isOverloaded) {
    borderColor = 'border-amber-500'
    statusLabel = 'Overloaded'
    statusColor = 'text-amber-400'
    dotColor = 'bg-amber-400 animate-pulse'
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

      {/* Metrics grid */}
      {noSensor ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p className="text-zinc-500 text-sm text-center">PZEM sensor not yet installed</p>
          <p className="text-zinc-600 text-xs text-center">Readings will appear once sensor is connected</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Metric label="Voltage" value={data.voltage} unit="V" />
          <Metric label="Current" value={data.current} unit="A" warn={data.current > 18} />
          <Metric label="Power" value={data.power} unit="W" warn={data.power > 4000} />
          <Metric label="Frequency" value={data.frequency} unit="Hz" />
          <Metric label="Power Factor" value={data.pf} unit="" />
          <Metric label="Energy" value={data.energy} unit="kWh" />
        </div>
      )}

      {/* Load bar (only when sensor present) */}
      {!noSensor && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Load</span>
            <span>{data.power != null ? `${Math.min(100, Math.round((data.power / 5000) * 100))}%` : '—'}</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isOverloaded ? 'bg-amber-400' : 'bg-blue-500'
              }`}
              style={{ width: data.power != null ? `${Math.min(100, (data.power / 5000) * 100)}%` : '0%' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
