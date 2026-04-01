'use client'

export default function ControlPanel({ activeSource, mode, onSwitch, onModeChange, onCutoff, cutoff, switching }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-5">
      <div>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Control Panel</span>
        <h2 className="text-white text-base font-bold">Source & Protection Management</h2>
      </div>

      {/* Active source indicator */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800">
        <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div>
          <p className="text-zinc-400 text-xs">Currently supplying load</p>
          <p className="text-white font-bold text-lg">Power Source {activeSource}</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-2">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">Switching Mode</span>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button
            onClick={() => onModeChange('auto')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              mode === 'auto' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => onModeChange('manual')}
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${
              mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Manual
          </button>
        </div>
        <p className="text-zinc-600 text-xs">
          {mode === 'auto'
            ? 'System auto-switches based on load and availability. Cutoff triggers at >4000W.'
            : 'Operator controls which source supplies the load.'}
        </p>
      </div>

      {/* Manual switch buttons */}
      <div className="flex flex-col gap-2">
        <span className="text-zinc-400 text-xs uppercase tracking-wide">Manual Override</span>
        <div className="flex gap-2">
          <button
            onClick={() => onSwitch(1)}
            disabled={switching || activeSource === 1}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              activeSource === 1
                ? 'bg-blue-600/20 border-blue-600 text-blue-400 cursor-default'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-blue-600 hover:border-blue-600 hover:text-white disabled:opacity-50'
            }`}
          >
            {switching && activeSource !== 1 ? 'Switching…' : 'Use PS1'}
          </button>
          <button
            onClick={() => onSwitch(2)}
            disabled={switching || activeSource === 2}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              activeSource === 2
                ? 'bg-blue-600/20 border-blue-600 text-blue-400 cursor-default'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-blue-600 hover:border-blue-600 hover:text-white disabled:opacity-50'
            }`}
          >
            {switching && activeSource !== 2 ? 'Switching…' : 'Use PS2'}
          </button>
        </div>
        {mode === 'auto' && (
          <p className="text-amber-500/80 text-xs">Switch to Manual mode to use override buttons.</p>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800" />

      {/* Cutoff protection controls */}
      <div className="flex flex-col gap-3">
        <div>
          <span className="text-zinc-400 text-xs uppercase tracking-wide">Overload Protection</span>
          <p className="text-zinc-600 text-xs mt-0.5">
            Cut or restore power lines via R5 (PWR1) and R6 (PWR2)
          </p>
        </div>

        <div className="flex gap-2">
          {/* PS1 Cutoff */}
          <button
            onClick={() => onCutoff(1, !cutoff?.ps1)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              cutoff?.ps1
                ? 'bg-red-600/20 border-red-600 text-red-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-red-600/10 hover:border-red-600/50 hover:text-red-400'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span>{cutoff?.ps1 ? '⚡ PS1 CUT' : 'PS1 — R5'}</span>
              <span className="text-[10px] font-normal opacity-70">
                {cutoff?.ps1 ? 'Click to restore' : 'Click to cut'}
              </span>
            </div>
          </button>

          {/* PS2 Cutoff */}
          <button
            onClick={() => onCutoff(2, !cutoff?.ps2)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              cutoff?.ps2
                ? 'bg-red-600/20 border-red-600 text-red-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-red-600/10 hover:border-red-600/50 hover:text-red-400'
            }`}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span>{cutoff?.ps2 ? '⚡ PS2 CUT' : 'PS2 — R6'}</span>
              <span className="text-[10px] font-normal opacity-70">
                {cutoff?.ps2 ? 'Click to restore' : 'Click to cut'}
              </span>
            </div>
          </button>
        </div>

        {(cutoff?.ps1 || cutoff?.ps2) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-red-400 text-xs">
              {cutoff?.ps1 && cutoff?.ps2
                ? 'Both power lines are disconnected!'
                : cutoff?.ps1
                  ? 'PWR1 line is disconnected (R5 active)'
                  : 'PWR2 line is disconnected (R6 active)'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
