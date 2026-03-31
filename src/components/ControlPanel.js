'use client'

export default function ControlPanel({ activeSource, mode, onSwitch, onModeChange, switching }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-5">
      <div>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Control Panel</span>
        <h2 className="text-white text-base font-bold">Source Management</h2>
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
            ? 'System auto-switches based on load and availability.'
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
    </div>
  )
}
