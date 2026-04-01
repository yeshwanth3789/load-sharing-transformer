'use client'

export default function LiveChart({ history, label, unit, color = '#3b82f6', min, max }) {
  if (!history || history.length < 2) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3">
        <div>
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Live Chart</span>
          <h2 className="text-white text-base font-bold">{label}</h2>
        </div>
        <div className="h-24 flex items-center justify-center text-zinc-600 text-sm">Collecting data…</div>
      </div>
    )
  }

  const W = 400
  const H = 80
  const pad = 4

  const vals = history.map((h) => h.value)
  const lo = min ?? Math.min(...vals)
  const hi = max ?? Math.max(...vals)
  const range = hi - lo || 1

  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2)
    const y = H - pad - ((v - lo) / range) * (H - pad * 2)
    return `${x},${y}`
  })

  const polyline = pts.join(' ')
  const areaPath = `M${pts[0]} L${pts.join(' L')} L${W - pad},${H - pad} L${pad},${H - pad} Z`

  const latest = vals[vals.length - 1]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Live Chart</span>
          <h2 className="text-white text-base font-bold">{label}</h2>
        </div>
        <span className="font-mono text-xl font-semibold text-white">
          {latest?.toFixed(1)} <span className="text-zinc-500 text-sm">{unit}</span>
        </span>
      </div>

      {(() => {
        // Unique gradient ID per chart to avoid SVG ID collisions
        const gradId = `chartGrad-${label.replace(/\s+/g, '-').toLowerCase()}`
        return (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: '80px' }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradId})`} />
            <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            <circle
              cx={W - pad}
              cy={H - pad - ((latest - lo) / range) * (H - pad * 2)}
              r="3"
              fill={color}
            />
          </svg>
        )
      })()}

      <div className="flex justify-between text-xs text-zinc-600">
        <span>{history[0]?.time}</span>
        <span>{history[history.length - 1]?.time}</span>
      </div>
    </div>
  )
}
