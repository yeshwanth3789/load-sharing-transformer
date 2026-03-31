'use client'

const ICONS = {
  info:    { color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  error:   { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/20' },
  success: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
}

function AlertIcon({ type }) {
  const paths = {
    info:    <path d="M12 8v4M12 16h.01" strokeLinecap="round" />,
    warning: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
    error:   <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
    success: <><polyline points="20 6 9 17 4 12" /></>,
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={ICONS[type].color}>
      {paths[type]}
    </svg>
  )
}

export default function AlertFeed({ alerts }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Event Log</span>
          <h2 className="text-white text-base font-bold">Alerts & Notifications</h2>
        </div>
        {alerts.length > 0 && (
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{alerts.length}</span>
        )}
      </div>

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-zinc-600 text-sm">No events yet</div>
        ) : (
          [...alerts].reverse().map((alert) => {
            const style = ICONS[alert.type] || ICONS.info
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} ${style.border}`}
              >
                <div className="mt-0.5 shrink-0">
                  <AlertIcon type={alert.type} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-white text-sm font-medium leading-tight">{alert.message}</span>
                  <span className="text-zinc-500 text-xs">{alert.time}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
