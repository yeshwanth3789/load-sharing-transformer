'use client'

import { useState, useEffect } from 'react'

export default function Header({ flaskConnected, demoMode, onDemoToggle, rpiUrl, onUrlChange }) {
  const [time, setTime] = useState('')
  const [showIpInput, setShowIpInput] = useState(false)
  const [ipDraft, setIpDraft] = useState('')

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Show IP input automatically when RPi is offline in live mode
  useEffect(() => {
    if (!demoMode && !flaskConnected) {
      setShowIpInput(true)
    }
  }, [demoMode, flaskConnected])

  function handleIpSubmit(e) {
    e.preventDefault()
    if (ipDraft.trim()) {
      onUrlChange(ipDraft.trim())
      setShowIpInput(false)
    }
  }

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      {/* Main row */}
      <div className="flex items-center justify-between px-6 py-4">
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
          {/* Demo / Live mode toggle */}
          <button
            onClick={onDemoToggle}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              demoMode
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {demoMode ? '🧪 DEMO MODE' : '📡 LIVE MODE'}
          </button>

          {/* Connection status + gear button */}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              demoMode
                ? 'bg-amber-500'
                : flaskConnected
                  ? 'bg-green-400 animate-pulse'
                  : 'bg-red-500 animate-pulse'
            }`} />
            <span className={`text-xs font-medium ${
              demoMode
                ? 'text-amber-500'
                : flaskConnected
                  ? 'text-green-400'
                  : 'text-red-400'
            }`}>
              {demoMode
                ? 'Demo Data'
                : flaskConnected
                  ? 'RPi Connected'
                  : 'RPi Offline'}
            </span>

            {/* Settings gear — toggle IP input */}
            {!demoMode && (
              <button
                onClick={() => { setShowIpInput((v) => !v); setIpDraft(rpiUrl || '') }}
                className="ml-1 p-1 rounded hover:bg-zinc-800 transition-colors"
                title="Change RPi address"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
            )}
          </div>

          <span className="text-zinc-400 text-sm font-mono">{time}</span>
        </div>
      </div>

      {/* IP address input bar — slides open */}
      {showIpInput && !demoMode && (
        <div className="px-6 pb-3">
          <form onSubmit={handleIpSubmit} className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 focus-within:border-blue-500 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              <input
                type="text"
                value={ipDraft}
                onChange={(e) => setIpDraft(e.target.value)}
                placeholder="192.168.1.100 or raspberrypi.local"
                className="flex-1 bg-transparent text-white text-sm font-mono outline-none placeholder-zinc-600"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={() => setShowIpInput(false)}
              className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 text-sm hover:text-white transition-colors"
            >
              ✕
            </button>
          </form>
          <p className="text-zinc-600 text-xs mt-1.5">
            Enter the RPi IP address or hostname. Port 5000 is used by default.
            Currently: <span className="text-zinc-400 font-mono">{rpiUrl}</span>
          </p>
        </div>
      )}
    </header>
  )
}
