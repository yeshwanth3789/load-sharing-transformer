'use client'

const MAX_LOAD_W = 5000 // Maximum load capacity per source in Watts
const MAX_CURRENT_A = 20 // Maximum current capacity per source in Amps

function getLoadColor(pct) {
  if (pct >= 85) return { ring: '#ef4444', bg: '#ef444420', text: 'text-red-400', label: 'CRITICAL' }
  if (pct >= 65) return { ring: '#f59e0b', bg: '#f59e0b20', text: 'text-amber-400', label: 'HIGH' }
  if (pct >= 35) return { ring: '#3b82f6', bg: '#3b82f620', text: 'text-blue-400', label: 'MODERATE' }
  if (pct > 0) return { ring: '#22c55e', bg: '#22c55e20', text: 'text-emerald-400', label: 'LOW' }
  return { ring: '#3f3f46', bg: '#3f3f4620', text: 'text-zinc-500', label: 'NO LOAD' }
}

function RadialGauge({ percentage, power, color, size = 120 }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  const center = size / 2

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      <defs>
        <filter id={`glow-${color.ring.replace('#', '')}`}>
          <feGaussianBlur stdDeviation="3" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke="#27272a" strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Progress */}
      <circle
        cx={center} cy={center} r={radius}
        fill="none" stroke={color.ring} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease-in-out, stroke 0.5s ease' }}
        filter={percentage > 0 ? `url(#glow-${color.ring.replace('#', '')})` : undefined}
      />

      {/* Center text */}
      <text x={center} y={center - 8} textAnchor="middle" fontSize="22" fontWeight="bold"
        fill="white" fontFamily="ui-monospace, monospace">
        {Math.round(percentage)}%
      </text>
      <text x={center} y={center + 10} textAnchor="middle" fontSize="10"
        fill="#71717a" fontFamily="ui-monospace, monospace">
        {power != null ? `${power.toFixed(0)}W` : '—'}
      </text>
    </svg>
  )
}

function StatRow({ icon, label, value, unit, warn }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-zinc-600 text-sm">{icon}</span>
        <span className="text-zinc-500 text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-sm font-semibold ${warn ? 'text-amber-400' : 'text-zinc-200'}`}>
          {value ?? '—'}
        </span>
        {value != null && <span className="text-zinc-600 text-xs">{unit}</span>}
      </div>
    </div>
  )
}

function SourceLoadCard({ id, data, isActive, isCutoff, accentColor }) {
  const noSensor = !data.sensor_connected
  const hasError = noSensor && data.error
  const power = data.power ?? 0
  const current = data.current ?? 0
  const loadPct = data.power != null ? Math.min(100, (power / MAX_LOAD_W) * 100) : 0
  const currentPct = data.current != null ? Math.min(100, (current / MAX_CURRENT_A) * 100) : 0
  const color = isCutoff
    ? { ring: '#ef4444', bg: '#ef444420', text: 'text-red-400', label: 'CUT OFF' }
    : getLoadColor(loadPct)

  return (
    <div className={`rounded-xl border ${isActive ? 'border-zinc-700' : 'border-zinc-800/60'} bg-zinc-900/80 backdrop-blur p-5 flex flex-col gap-4 transition-all duration-500`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold`}
            style={{ backgroundColor: accentColor + '18', color: accentColor }}>
            {id}
          </div>
          <div>
            <h3 className="text-white text-sm font-semibold">Power Source {id}</h3>
            <span className={`text-xs ${
              isCutoff ? 'text-red-400' : isActive ? 'text-emerald-400' : 'text-zinc-600'
            }`}>
              {isCutoff ? '⚡ Cut Off' : isActive ? '● Supplying Load' : '○ Standby'}
            </span>
          </div>
        </div>
        {(!noSensor || isCutoff) && (
          <div className={`px-2.5 py-1 rounded-full text-xs font-semibold ${color.text}`}
            style={{ backgroundColor: color.bg }}>
            {color.label}
          </div>
        )}
      </div>

      {noSensor ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2">
          {hasError ? (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-500">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-orange-400 text-sm font-semibold">Sensor Offline</p>
              <p className="text-zinc-600 text-xs text-center max-w-[200px]" title={data.error}>{data.error}</p>
            </>
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-700">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <p className="text-zinc-600 text-sm">No sensor connected</p>
              <p className="text-zinc-700 text-xs">Load data unavailable</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Gauge */}
          <div className="flex justify-center">
            <RadialGauge percentage={isCutoff ? 0 : loadPct} power={isCutoff ? 0 : data.power} color={color} />
          </div>

          {/* Current draw bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Current Draw</span>
              <span className="text-zinc-400 font-mono">{current.toFixed(1)}A / {MAX_CURRENT_A}A</span>
            </div>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${isCutoff ? 0 : currentPct}%`,
                  background: `linear-gradient(90deg, ${color.ring}88, ${color.ring})`,
                }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="border-t border-zinc-800/60 pt-3 flex flex-col">
            <StatRow icon="⚡" label="Active Power" value={data.power?.toFixed(1)} unit="W"
              warn={data.power > 4000} />
            <StatRow icon="🔌" label="Current" value={data.current?.toFixed(2)} unit="A"
              warn={data.current > 18} />
            <StatRow icon="📊" label="Power Factor" value={data.pf?.toFixed(2)} unit="" />
            <StatRow icon="🔋" label="Energy Used" value={data.energy?.toFixed(0)} unit="Wh" />
          </div>
        </>
      )}
    </div>
  )
}

function TotalLoadBar({ ps1Power, ps2Power }) {
  const total = (ps1Power ?? 0) + (ps2Power ?? 0)
  const maxTotal = MAX_LOAD_W * 2
  const totalPct = Math.min(100, (total / maxTotal) * 100)
  const ps1Pct = total > 0 ? ((ps1Power ?? 0) / total) * 100 : 0
  const ps2Pct = total > 0 ? ((ps2Power ?? 0) / total) * 100 : 0

  return (
    <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 backdrop-blur p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-zinc-500 text-xs font-medium uppercase tracking-widest">System Overview</span>
          <h3 className="text-white text-base font-bold">Total Load Distribution</h3>
        </div>
        <div className="text-right">
          <span className="font-mono text-2xl font-bold text-white">{total.toFixed(0)}</span>
          <span className="text-zinc-500 text-sm ml-1">W</span>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex flex-col gap-2">
        <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden flex">
          {ps1Power > 0 && (
            <div
              className="h-full transition-all duration-700 rounded-l-full"
              style={{
                width: `${ps1Pct}%`,
                background: 'linear-gradient(90deg, #22c55e, #3b82f6)',
              }}
            />
          )}
          {ps2Power > 0 && (
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${ps2Pct}%`,
                background: 'linear-gradient(90deg, #8b5cf6, #a855f7)',
                borderRadius: ps1Power > 0 ? '0 9999px 9999px 0' : '9999px',
              }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between text-xs mt-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #22c55e, #3b82f6)' }} />
              <span className="text-zinc-400">PS1</span>
              <span className="text-zinc-200 font-mono font-semibold">{(ps1Power ?? 0).toFixed(0)}W</span>
              {total > 0 && <span className="text-zinc-600">({ps1Pct.toFixed(0)}%)</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)' }} />
              <span className="text-zinc-400">PS2</span>
              <span className="text-zinc-200 font-mono font-semibold">{(ps2Power ?? 0).toFixed(0)}W</span>
              {total > 0 && <span className="text-zinc-600">({ps2Pct.toFixed(0)}%)</span>}
            </div>
          </div>
          <span className="text-zinc-600">
            Capacity: {totalPct.toFixed(0)}% of {(maxTotal / 1000).toFixed(0)}kW
          </span>
        </div>
      </div>
    </div>
  )
}

export default function LoadDistribution({ ps1, ps2, activeSource, cutoff }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Section title */}
      <div className="flex items-center gap-3">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
        <div>
          <h2 className="text-white text-lg font-bold">Load Distribution</h2>
          <p className="text-zinc-500 text-xs">Real-time power consumption per source</p>
        </div>
      </div>

      {/* Total system load bar */}
      <TotalLoadBar ps1Power={ps1.power} ps2Power={ps2.power} />

      {/* Per-source cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SourceLoadCard id={1} data={ps1} isActive={activeSource === 1}
          isCutoff={cutoff?.ps1} accentColor="#3b82f6" />
        <SourceLoadCard id={2} data={ps2} isActive={activeSource === 2}
          isCutoff={cutoff?.ps2} accentColor="#8b5cf6" />
      </div>
    </div>
  )
}
