'use client'

function ChangeoverRelay({ label, active, psLabel, wire, manual, onToggle }) {
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
        {active ? 'ENERGIZED' : 'DEFAULT'}
      </span>
      <div className="text-center">
        <span className="text-zinc-300 text-xs font-medium block">{label}</span>
        <span className="text-zinc-500 text-[10px]">{psLabel} — {wire}</span>
      </div>
      {manual && (
        <button
          onClick={() => onToggle(label, !active)}
          className={`mt-1 w-full text-xs font-bold py-1 rounded transition-colors ${
            active
              ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
              : 'bg-amber-600 hover:bg-amber-500 text-white'
          }`}
        >
          {active ? 'RELEASE' : 'ENERGIZE'}
        </button>
      )}
    </div>
  )
}

function CutoffRelay({ label, gpioPin, psLabel, isCut, manual, onToggle }) {
  return (
    <div className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition-colors duration-500 ${
      isCut ? 'border-red-600 bg-red-900/20' : 'border-emerald-800/40 bg-emerald-900/10'
    }`}>
      {/* Cutoff symbol - scissors / break */}
      <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
        {isCut ? (
          <>
            <line x1="0" y1="10" x2="10" y2="10" stroke="#ef4444" strokeWidth="2" />
            <line x1="18" y1="10" x2="28" y2="10" stroke="#ef4444" strokeWidth="2" />
            <line x1="10" y1="6" x2="18" y2="14" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="10" y1="14" x2="18" y2="6" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <line x1="0" y1="10" x2="28" y2="10" stroke="#34d399" strokeWidth="2" />
            <circle cx="14" cy="10" r="4" fill="none" stroke="#34d399" strokeWidth="1.5" />
          </>
        )}
      </svg>
      <span className={`text-xs font-bold ${isCut ? 'text-red-400' : 'text-emerald-400'}`}>
        {isCut ? '⚡ CUT' : '● FLOWING'}
      </span>
      <div className="text-center">
        <span className="text-zinc-300 text-xs font-medium block">{label}</span>
        <span className="text-zinc-500 text-[10px]">{psLabel} cutoff · GPIO {gpioPin}</span>
      </div>
      {manual && (
        <button
          onClick={() => onToggle(label, !isCut)}
          className={`mt-1 w-full text-xs font-bold py-1 rounded transition-colors ${
            isCut
              ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
              : 'bg-red-700 hover:bg-red-600 text-white'
          }`}
        >
          {isCut ? 'RESTORE' : 'CUT'}
        </button>
      )}
    </div>
  )
}

export default function RelayPanel({ relays, cutoff, mode, onRelayToggle }) {
  const manual = mode === 'manual'
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-5">
      {/* Changeover relays */}
      <div>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Relay Status</span>
        <h2 className="text-white text-base font-bold">Source Switching — R1–R4</h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          DEFAULT = NC path (home source) · ENERGIZED = NO path (backup source)
        </p>
      </div>

      {manual && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/20 border border-amber-700/40 text-amber-400 text-xs font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          Manual relay control active — changes take effect immediately
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ChangeoverRelay label="R1" psLabel="PS1" wire="L-wire" active={relays.ps1_l} manual={manual} onToggle={onRelayToggle} />
        <ChangeoverRelay label="R2" psLabel="PS1" wire="N-wire" active={relays.ps1_n} manual={manual} onToggle={onRelayToggle} />
        <ChangeoverRelay label="R3" psLabel="PS2" wire="L-wire" active={relays.ps2_l} manual={manual} onToggle={onRelayToggle} />
        <ChangeoverRelay label="R4" psLabel="PS2" wire="N-wire" active={relays.ps2_n} manual={manual} onToggle={onRelayToggle} />
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800" />

      {/* Cutoff relays */}
      <div>
        <h2 className="text-white text-base font-bold">Overload Protection — R5–R6</h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          Cutoff relays disconnect power lines when load exceeds 4000W (auto mode)
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <CutoffRelay label="R5" gpioPin="24" psLabel="PWR1" isCut={cutoff?.ps1 || relays.ps1_cut} manual={manual} onToggle={onRelayToggle} />
        <CutoffRelay label="R6" gpioPin="25" psLabel="PWR2" isCut={cutoff?.ps2 || relays.ps2_cut} manual={manual} onToggle={onRelayToggle} />
      </div>

      <p className="text-zinc-600 text-xs">
        R1–R4 changeover: both L and N must switch together. R5–R6 cutoff: active-low GPIO, energizing opens NC path = power cut.
      </p>
    </div>
  )
}
