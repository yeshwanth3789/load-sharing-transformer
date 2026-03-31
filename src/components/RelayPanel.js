'use client'

function RelayIndicator({ label, active, psLabel }) {
  return (
    <div className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors duration-500 ${
      active ? 'border-green-600 bg-green-900/20' : 'border-zinc-800 bg-zinc-900'
    }`}>
      {/* Relay symbol */}
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        <circle cx="4" cy="10" r="3" fill={active ? '#22c55e' : '#52525b'} />
        <circle cx="24" cy="10" r="3" fill={active ? '#22c55e' : '#52525b'} />
        {active ? (
          <line x1="7" y1="10" x2="21" y2="10" stroke="#22c55e" strokeWidth="2" />
        ) : (
          <line x1="7" y1="10" x2="18" y2="4" stroke="#52525b" strokeWidth="2" />
        )}
      </svg>
      <span className={`text-xs font-semibold ${active ? 'text-green-400' : 'text-zinc-500'}`}>
        {active ? 'CLOSED' : 'OPEN'}
      </span>
      <span className="text-zinc-400 text-xs">{psLabel} — {label}</span>
    </div>
  )
}

export default function RelayPanel({ relays }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">
      <div>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Relay Status</span>
        <h2 className="text-white text-base font-bold">4-Relay Bank</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <RelayIndicator label="L-wire" psLabel="PS1" active={relays.ps1_l} />
        <RelayIndicator label="N-wire" psLabel="PS1" active={relays.ps1_n} />
        <RelayIndicator label="L-wire" psLabel="PS2" active={relays.ps2_l} />
        <RelayIndicator label="N-wire" psLabel="PS2" active={relays.ps2_n} />
      </div>
      <p className="text-zinc-600 text-xs">
        Both L and N relays of a source must be closed for it to supply load.
      </p>
    </div>
  )
}
