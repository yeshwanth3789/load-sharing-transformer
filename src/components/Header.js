'use client'

import { useState, useEffect } from 'react'

export default function Header({ flaskConnected, demoMode, onDemoToggle }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div>
          <h1 className="text-white font-bold text-lg leading-none">GridSentinel</h1>
          <p className="text-zinc-500 text-xs">IoT Power Monitoring System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Demo mode toggle */}
        <button
          onClick={onDemoToggle}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            demoMode
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-zinc-200'
          }`}
        >
          {demoMode ? 'DEMO MODE' : 'LIVE MODE'}
        </button>

        {/* Flask connection status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${flaskConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className={`text-xs font-medium ${flaskConnected ? 'text-green-400' : 'text-red-400'}`}>
            {flaskConnected ? 'Flask Connected' : 'Flask Offline'}
          </span>
        </div>

        <span className="text-zinc-400 text-sm font-mono">{time}</span>
      </div>
    </header>
  )
}
