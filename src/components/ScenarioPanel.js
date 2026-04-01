'use client'

const scenarios = [
  {
    id: 'normal',
    label: 'Normal Operation',
    desc: 'PS1 active, stable readings',
    color: 'green',
  },
  {
    id: 'ps1_fault',
    label: 'PS1 Fault → Auto-switch',
    desc: 'PS1 fails, system switches to PS2',
    color: 'red',
  },
  {
    id: 'high_load',
    label: 'High Load Warning',
    desc: 'Current spikes near overload threshold',
    color: 'amber',
  },
  {
    id: 'overload_cutoff',
    label: 'Overload Cutoff (R5)',
    desc: 'PS1 exceeds 4000W — R5 cuts power line',
    color: 'red',
  },
  {
    id: 'manual_switch',
    label: 'Manual Switch to PS2',
    desc: 'Operator forces switch to PS2',
    color: 'blue',
  },
  {
    id: 'ps1_restore',
    label: 'PS1 Restored',
    desc: 'PS1 comes back online, system re-evaluates',
    color: 'green',
  },
  {
    id: 'load_sharing',
    label: 'Load Sharing Test',
    desc: 'PS1 at 3200W exceeds threshold — overflow goes to PS2',
    color: 'amber',
  },
  {
    id: 'deploy_dtr',
    label: '🚨 Deploy DTR Emergency',
    desc: 'Both sources overloaded — combined load exceeds total capacity',
    color: 'red',
  },
]

const colorMap = {
  green: 'border-green-700/50 hover:border-green-500 text-green-400',
  red:   'border-red-700/50 hover:border-red-500 text-red-400',
  amber: 'border-amber-700/50 hover:border-amber-500 text-amber-400',
  blue:  'border-blue-700/50 hover:border-blue-500 text-blue-400',
}

export default function ScenarioPanel({ onScenario, activeScenario }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-4">
      <div>
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Demo / Testing</span>
        <h2 className="text-white text-base font-bold">Scenarios</h2>
        <p className="text-zinc-500 text-xs mt-0.5">Simulate events to test dashboard behaviour</p>
      </div>

      <div className="flex flex-col gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => onScenario(s.id)}
            className={`flex items-center justify-between p-3 rounded-lg border bg-zinc-800/50 transition-all text-left ${
              activeScenario === s.id
                ? `${colorMap[s.color]} bg-zinc-800`
                : 'border-zinc-700 hover:border-zinc-500 text-zinc-300'
            }`}
          >
            <div>
              <p className="text-sm font-semibold leading-tight">{s.label}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{s.desc}</p>
            </div>
            {activeScenario === s.id && (
              <span className={`text-xs font-bold shrink-0 ml-3 ${colorMap[s.color].split(' ')[2]}`}>ACTIVE</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
