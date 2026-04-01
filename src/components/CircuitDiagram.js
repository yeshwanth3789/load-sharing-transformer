'use client'

/* ═══════════════════════════════════════════════════════════════════════════
   CIRCUIT DIAGRAM — Redesigned with NO overlapping wires
   ═══════════════════════════════════════════════════════════════════════════

   LAYOUT (top→bottom):
   ────────────────────
   y=50     PS1 (left, x=120)          PS2 (right, x=880)
   y=100    PWR1-L horizontal rail     ── goes to R1(NC), R3(NO)
   y=130    PWR1-N horizontal rail     ── goes to R2(NC), R4(NO)
   y=170    PWR2-L horizontal rail     ── goes to R1(NO), R3(NC)
   y=200    PWR2-N horizontal rail     ── goes to R2(NO), R4(NC)

   y=260    RELAY ROW: R1(x=260) R2(x=380) ──gap── R3(x=620) R4(x=740)
            Wide spacing eliminates overlap.
            GPIO bus runs BELOW relays at y=325

   y=350    RPi (x=500, centred between relay groups)

   y=410    LOAD RAIL L      PWR1 load(x=180-370)   PWR2 load(x=630-820)
   y=490    Loads:            Socket(x=230) Bulb(x=330) | Bulb1(x=680) Bulb2(x=780)
   y=560    LOAD RAIL N

   y=610    Buzzer(x=170) + Legend(x=680)

   Viewbox: 1000 x 680
   ─────────────────────────────────────────────────────────────────────── */

// ─── Primitives ─────────────────────────────────────────────────────────────

const Wire = ({ x1, y1, x2, y2, color = '#3f3f46', dash, width = 2 }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2}
    stroke={color} strokeWidth={width}
    strokeDasharray={dash ? '5,4' : undefined} />
)

const Lbl = ({ x, y, txt, color = '#71717a', size = 10, anchor = 'middle', bold }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color}
    fontFamily="ui-monospace, monospace" fontWeight={bold ? 'bold' : 'normal'}>{txt}</text>
)

const Dot = ({ x, y, color }) => <circle cx={x} cy={y} r={3.5} fill={color} />

/* Wire bridge — small arc drawn where one wire crosses another without connecting */
function Bridge({ x, y, vertical = true, color = '#3f3f46', width = 2 }) {
  // If vertical wire crosses a horizontal rail at (x,y), draw a bump
  if (vertical) {
    return (
      <g>
        <line x1={x} y1={y - 8} x2={x} y2={y - 6} stroke={color} strokeWidth={width} />
        <path d={`M${x},${y - 6} a6,6 0 0,1 0,12`} fill="none" stroke={color} strokeWidth={width} />
        <line x1={x} y1={y + 6} x2={x} y2={y + 8} stroke={color} strokeWidth={width} />
      </g>
    )
  }
  // Horizontal wire crossing a vertical one
  return (
    <g>
      <line x1={x - 8} y1={y} x2={x - 6} y2={y} stroke={color} strokeWidth={width} />
      <path d={`M${x - 6},${y} a6,6 0 0,0 12,0`} fill="none" stroke={color} strokeWidth={width} />
      <line x1={x + 6} y1={y} x2={x + 8} y2={y} stroke={color} strokeWidth={width} />
    </g>
  )
}

// ─── Components ─────────────────────────────────────────────────────────────

function Sw({ x, y, label, color }) {
  return (
    <g>
      <Wire x1={x - 14} y1={y} x2={x - 6} y2={y} color={color} />
      <circle cx={x - 6} cy={y} r={2.5} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={x + 6} cy={y} r={2.5} fill="none" stroke={color} strokeWidth={1.5} />
      <line x1={x - 6} y1={y} x2={x + 4} y2={y - 9} stroke={color} strokeWidth={2} />
      <Wire x1={x + 6} y1={y} x2={x + 14} y2={y} color={color} />
      <Lbl x={x} y={y - 14} txt={label} color="#a3e635" size={10} />
    </g>
  )
}

function Pzem({ x, y, color }) {
  return (
    <g>
      <Wire x1={x - 18} y1={y} x2={x - 13} y2={y} color={color} />
      <circle cx={x} cy={y} r={13} fill="#0c1a2e" stroke="#38bdf8" strokeWidth={1.5} />
      {[0, 1, 2].map(i => (
        <path key={i} d={`M${x - 8 + i * 6} ${y} a3 3 0 0 1 6 0`} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      ))}
      <Wire x1={x + 13} y1={y} x2={x + 18} y2={y} color={color} />
      <Lbl x={x} y={y - 19} txt="PZEM" color="#38bdf8" size={9} />
    </g>
  )
}

function Relay({ x, y, label, energized }) {
  const bg = energized ? '#1e3a5f' : '#18181b'
  const bd = energized ? '#3b82f6' : '#3f3f46'
  const tc = energized ? '#93c5fd' : '#71717a'
  return (
    <g>
      <rect x={x - 26} y={y - 28} width={52} height={56} rx={5}
        fill={bg} stroke={bd} strokeWidth={energized ? 2 : 1.5} />
      {energized
        ? <line x1={x - 14} y1={y - 6} x2={x + 14} y2={y - 6} stroke="#3b82f6" strokeWidth={1.5} />
        : <line x1={x - 14} y1={y - 14} x2={x + 6} y2={y - 6} stroke="#52525b" strokeWidth={1.5} />
      }
      <Lbl x={x} y={y + 8} txt={label} color={energized ? '#60a5fa' : '#e4e4e7'} size={13} bold />
      <Lbl x={x} y={y + 22} txt="COM" color={tc} size={8} />
      <Lbl x={x - 16} y={y - 18} txt="NO" color="#4ade80" size={8} />
      <Lbl x={x + 16} y={y - 18} txt="NC" color={tc} size={8} />
    </g>
  )
}

function Bulb({ x, y, label, on }) {
  const c = on ? '#fbbf24' : '#3f3f46'
  return (
    <g>
      {on && <circle cx={x} cy={y} r={20} fill="#fbbf2428" />}
      <circle cx={x} cy={y} r={12} fill="none" stroke={c} strokeWidth={1.8} />
      <line x1={x - 8} y1={y - 8} x2={x + 8} y2={y + 8} stroke={c} strokeWidth={1.5} />
      <line x1={x + 8} y1={y - 8} x2={x - 8} y2={y + 8} stroke={c} strokeWidth={1.5} />
      <Lbl x={x} y={y + 24} txt={label} color={c} size={10} />
    </g>
  )
}

function Socket({ x, y, on }) {
  const c = on ? '#34d399' : '#3f3f46'
  return (
    <g>
      <rect x={x - 13} y={y - 13} width={26} height={26} rx={4}
        fill="none" stroke={c} strokeWidth={1.8} />
      <line x1={x - 5} y1={y - 7} x2={x - 5} y2={y + 7} stroke={c} strokeWidth={2} />
      <line x1={x + 5} y1={y - 7} x2={x + 5} y2={y + 7} stroke={c} strokeWidth={2} />
      <Lbl x={x} y={y + 26} txt="Socket" color={c} size={10} />
    </g>
  )
}

function PS({ x, y, label, active }) {
  const c = active ? '#22c55e' : '#52525b'
  return (
    <g>
      <rect x={x - 36} y={y - 18} width={72} height={36} rx={6}
        fill={active ? '#14532d' : '#18181b'} stroke={c} strokeWidth={active ? 2 : 1.5} />
      <Lbl x={x} y={y - 3} txt={label} color={c} size={14} bold />
      <Lbl x={x} y={y + 11} txt={active ? '● ACTIVE' : '○ STANDBY'} color={c} size={8} />
    </g>
  )
}

function RPi({ x, y }) {
  return (
    <g>
      <rect x={x - 40} y={y - 24} width={80} height={48} rx={5}
        fill="#1c1917" stroke="#78716c" strokeWidth={1.5} />
      <Lbl x={x} y={y - 8} txt="RPi 4B" color="#fb923c" size={12} bold />
      <Lbl x={x} y={y + 6} txt="S1 / GPIO" color="#78716c" size={9} />
      {[0, 1, 2, 3, 4, 5].map(i => (
        <circle key={i} cx={x - 18 + i * 7} cy={y + 18} r={2.5}
          fill={i % 2 === 0 ? '#f97316' : '#78716c'} />
      ))}
    </g>
  )
}

function Buzzer({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="none" stroke="#facc15" strokeWidth={1.5} />
      {[0, 1, 2].map(i => (
        <path key={i} d={`M${x - 6 + i * 5} ${y + 1} a2.5 2.5 0 0 1 5 0`}
          fill="none" stroke="#facc15" strokeWidth={1.5} />
      ))}
      <Lbl x={x} y={y + 22} txt="BA1" color="#facc15" size={10} />
    </g>
  )
}

/* Cutoff relay — inline on the power rail, shows break when cut */
function CutoffRelay({ x, y, label, gpioLabel, isCut, railColor }) {
  const bg = isCut ? '#450a0a' : '#18181b'
  const bd = isCut ? '#ef4444' : '#3f3f46'
  const tc = isCut ? '#fca5a5' : '#71717a'
  return (
    <g>
      <rect x={x - 22} y={y - 14} width={44} height={28} rx={4}
        fill={bg} stroke={bd} strokeWidth={isCut ? 2 : 1.5} />
      {isCut ? (
        <>
          <line x1={x - 10} y1={y - 6} x2={x + 10} y2={y + 6} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
          <line x1={x - 10} y1={y + 6} x2={x + 10} y2={y - 6} stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <line x1={x - 12} y1={y} x2={x + 12} y2={y} stroke="#34d399" strokeWidth={2} />
      )}
      <Lbl x={x} y={y - 19} txt={label} color={tc} size={10} bold />
      <Lbl x={x} y={y + 24} txt={gpioLabel} color="#52525b" size={8} />
      {isCut && <Lbl x={x} y={y - 28} txt="CUT" color="#ef4444" size={8} bold />}
    </g>
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function CircuitDiagram({
  relays = { ps1_l: false, ps1_n: false, ps2_l: false, ps2_n: false, ps1_cut: false, ps2_cut: false },
  activeSource = 1,
  cutoff = { ps1: false, ps2: false },
}) {
  const r1on = relays.ps1_l   // R1 = PS1 Live relay
  const r2on = relays.ps1_n   // R2 = PS1 Neutral relay
  const r3on = relays.ps2_l   // R3 = PS2 Live relay
  const r4on = relays.ps2_n   // R4 = PS2 Neutral relay
  const r5cut = cutoff.ps1 || relays.ps1_cut  // R5 = PWR1 cutoff
  const r6cut = cutoff.ps2 || relays.ps2_cut  // R6 = PWR2 cutoff

  const ps1 = activeSource === 1
  const ps2 = activeSource === 2

  const c1  = (ps1 && !r5cut) ? '#22c55e' : '#3f3f46'   // PS1 color (dim if cut)
  const c2  = (ps2 && !r6cut) ? '#a855f7' : '#3f3f46'   // PS2 color (dim if cut)
  const dim = '#27272a'                      // inactive wire

  // Active path logic — which relay terminal is live
  const ncR1 = (!r1on && ps1) ? c1 : dim    // R1 NC ← PWR1-L
  const ncR2 = (!r2on && ps1) ? c1 : dim    // R2 NC ← PWR1-N
  const ncR3 = (!r3on && ps2) ? c2 : dim    // R3 NC ← PWR2-L
  const ncR4 = (!r4on && ps2) ? c2 : dim    // R4 NC ← PWR2-N
  const noR1 = (r1on  && ps2) ? c2 : dim    // R1 NO ← PWR2-L
  const noR2 = (r2on  && ps2) ? c2 : dim    // R2 NO ← PWR2-N
  const noR3 = (r3on  && ps1) ? c1 : dim    // R3 NO ← PWR1-L
  const noR4 = (r4on  && ps1) ? c1 : dim    // R4 NO ← PWR1-N

  const comR1 = (ncR1 !== dim || noR1 !== dim) ? '#3b82f6' : dim
  const comR2 = (ncR2 !== dim || noR2 !== dim) ? '#3b82f6' : dim
  const comR3 = (ncR3 !== dim || noR3 !== dim) ? '#8b5cf6' : dim
  const comR4 = (ncR4 !== dim || noR4 !== dim) ? '#8b5cf6' : dim

  const ld1on = comR1 !== dim  // PWR1 load group is on
  const ld2on = comR3 !== dim  // PWR2 load group is on

  /* ── GEOMETRY ──────────────────────────────────────────────────────────
     All coordinates carefully placed to avoid any wire crossing/overlap.

     Rails (y):
       pw1L = 100  (PWR1 Live)
       pw1N = 130  (PWR1 Neutral)     ← gap of 30px between adjacent rails
       pw2L = 170  (PWR2 Live)        ← 40px gap between rail groups
       pw2N = 200  (PWR2 Neutral)

     Relays (y=260):
       R1 x=260   R2 x=380   (left group — PWR1 L/N)
       R3 x=620   R4 x=740   (right group — PWR2 L/N)
       Big gap in centre (x=406-594) for RPi / GPIO — no wires cross here

     NC terminal = rx+18 (drops from same-source rail — straight down, no crossing)
     NO terminal = rx-18 (drops from cross-source rail — routes around edges)

     Key routing rules:
       • R1-NC receives PWR1-L (y=100) → drops at x=278, straight vertical
       • R1-NO receives PWR2-L (y=170) → drops at x=242, straight vertical
         R1-NO is BELOW R1-NC rail, so it only passes 0 rails before reaching relay
       • R2-NC receives PWR1-N (y=130) → drops at x=398, BRIDGES over PWR2-L & PWR2-N
       • R2-NO receives PWR2-N (y=200) → drops at x=362, straight down
       • R3-NC receives PWR2-L (y=170) → drops at x=638, straight down
       • R3-NO receives PWR1-L (y=100) → drops at x=602, BRIDGES over PWR1-N, PWR2-L, PWR2-N
       • R4-NC receives PWR2-N (y=200) → drops at x=758, straight down
       • R4-NO receives PWR1-N (y=130) → drops at x=722, BRIDGES over PWR2-L, PWR2-N
  ──────────────────────────────────────────────────────────────────────── */

  const RY = 260
  const R1x = 260, R2x = 380, R3x = 620, R4x = 740
  const pw1L = 100, pw1N = 130, pw2L = 170, pw2N = 200

  // Load area
  const ldL = 410    // Load L rail y
  const ldN = 560    // Load N rail y
  const ldY = 490    // Load devices y

  // GPIO bus
  const gpioY = 325

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 overflow-x-auto">
      <div className="mb-3">
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Circuit View</span>
        <h2 className="text-white text-base font-bold">Full Circuit Diagram</h2>
        <p className="text-zinc-500 text-xs mt-0.5">
          NC = home source (default) · NO = backup source · COM → load · ⌒ = wire bridge (no connection)
        </p>
      </div>

      <svg viewBox="0 0 1000 680" className="w-full" style={{ minWidth: '800px', maxHeight: '660px' }}>
        {/* Grid */}
        <defs>
          <pattern id="circuitGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="1000" height="680" fill="url(#circuitGrid)" />

        {/* Section labels */}
        <Lbl x={320} y={25} txt="PWR 1 SIDE" color="#52525b" size={12} bold />
        <Lbl x={680} y={25} txt="PWR 2 SIDE" color="#52525b" size={12} bold />
        <Wire x1={500} y1={35} x2={500} y2={225} color="#1a1a1a" width={1} dash />

        {/* ═══ POWER SOURCES ═══════════════════════════════════════════════ */}
        <PS x={120} y={50} label="PS1" active={ps1} />
        <PS x={880} y={50} label="PS2" active={ps2} />

        {/* PS1 drops — separate vertical runs to each rail, no crossing needed */}
        {/* PS1 → PWR1-L at y=100 */}
        <Wire x1={120} y1={68} x2={120} y2={pw1L} color={c1} />
        {/* PS1 → PWR1-N at y=130 (separate vertical on the right side of PS1 box) */}
        <Wire x1={140} y1={68} x2={140} y2={pw1N} color={c1} />
        <Dot x={140} y={pw1N} color={c1} />

        {/* PS2 drops — separate vertical runs */}
        {/* PS2 → PWR2-L at y=170 */}
        <Wire x1={880} y1={68} x2={880} y2={pw2L} color={c2} />
        {/* PS2 → PWR2-N at y=200 */}
        <Wire x1={860} y1={68} x2={860} y2={pw2N} color={c2} />
        <Dot x={860} y={pw2N} color={c2} />

        {/* ═══ RAIL LABELS (left edge) ═════════════════════════════════════ */}
        <Lbl x={60} y={pw1L + 4} txt="PWR1-L" color={c1} size={9} anchor="end" />
        <Lbl x={60} y={pw1N + 4} txt="PWR1-N" color={c1} size={9} anchor="end" />
        <Lbl x={60} y={pw2L + 4} txt="PWR2-L" color={c2} size={9} anchor="end" />
        <Lbl x={60} y={pw2N + 4} txt="PWR2-N" color={c2} size={9} anchor="end" />

        {/* ═══ PWR1-L RAIL (y=100) ═════════════════════════════════════════
            PS1 → R5(cutoff) → SW1 → PZEM → R1-NC(278) → R3-NO(602) */}
        <Wire x1={120} y1={pw1L} x2={128} y2={pw1L} color={r5cut ? '#ef4444' : c1} />
        <CutoffRelay x={150} y={pw1L} label="R5" gpioLabel="GPIO 24" isCut={r5cut} railColor={c1} />
        <Wire x1={172} y1={pw1L} x2={183} y2={pw1L} color={c1} />
        <Sw x={200} y={pw1L} label="SW1" color={c1} />
        <Wire x1={214} y1={pw1L} x2={232} y2={pw1L} color={c1} />
        <Pzem x={250} y={pw1L} color={c1} />
        <Wire x1={268} y1={pw1L} x2={R1x + 18} y2={pw1L} color={c1} />
        <Dot x={R1x + 18} y={pw1L} color={c1} />
        {/* Continue PWR1-L across to R3-NO at x=602 */}
        <Wire x1={R1x + 18} y1={pw1L} x2={R3x - 18} y2={pw1L} color={c1} />
        <Dot x={R3x - 18} y={pw1L} color={c1} />

        {/* ═══ PWR1-N RAIL (y=130) ═════════════════════════════════════════
            PS1 → runs right to R2-NC(398) and continues to R4-NO(722) */}
        <Wire x1={140} y1={pw1N} x2={R2x + 18} y2={pw1N} color={c1} />
        <Dot x={R2x + 18} y={pw1N} color={c1} />
        <Wire x1={R2x + 18} y1={pw1N} x2={R4x - 18} y2={pw1N} color={c1} />
        <Dot x={R4x - 18} y={pw1N} color={c1} />

        {/* ═══ PWR2-L RAIL (y=170) ═════════════════════════════════════════
            PS2 → R6(cutoff) → SW2 → runs left to R3-NC(638) → R1-NO(242) */}
        <Wire x1={880} y1={pw2L} x2={872} y2={pw2L} color={r6cut ? '#ef4444' : c2} />
        <CutoffRelay x={850} y={pw2L} label="R6" gpioLabel="GPIO 25" isCut={r6cut} railColor={c2} />
        <Wire x1={828} y1={pw2L} x2={818} y2={pw2L} color={c2} />
        <Sw x={801} y={pw2L} label="SW2" color={c2} />
        <Wire x1={787} y1={pw2L} x2={R3x + 18} y2={pw2L} color={c2} />
        <Dot x={R3x + 18} y={pw2L} color={c2} />
        <Wire x1={R3x + 18} y1={pw2L} x2={R1x - 18} y2={pw2L} color={c2} />
        <Dot x={R1x - 18} y={pw2L} color={c2} />

        {/* ═══ PWR2-N RAIL (y=200) ═════════════════════════════════════════
            PS2 → runs left to R4-NC(758) and continues to R2-NO(362) */}
        <Wire x1={860} y1={pw2N} x2={R4x + 18} y2={pw2N} color={c2} />
        <Dot x={R4x + 18} y={pw2N} color={c2} />
        <Wire x1={R4x + 18} y1={pw2N} x2={R2x - 18} y2={pw2N} color={c2} />
        <Dot x={R2x - 18} y={pw2N} color={c2} />

        {/* ═══ VERTICAL DROPS: Rail → Relay Terminal ═══════════════════════
            Drops that DON'T cross any other rail go straight down.
            Drops that DO cross rails use bridge arcs at each crossing point. */}

        {/* R1 NC (x=278) ← PWR1-L (y=100) → straight down, crosses PWR1-N, PWR2-L, PWR2-N */}
        <Wire x1={R1x + 18} y1={pw1L} x2={R1x + 18} y2={pw1N - 8} color={ncR1} />
        <Bridge x={R1x + 18} y={pw1N} color={ncR1} />
        <Wire x1={R1x + 18} y1={pw1N + 8} x2={R1x + 18} y2={pw2L - 8} color={ncR1} />
        <Bridge x={R1x + 18} y={pw2L} color={ncR1} />
        <Wire x1={R1x + 18} y1={pw2L + 8} x2={R1x + 18} y2={pw2N - 8} color={ncR1} />
        <Bridge x={R1x + 18} y={pw2N} color={ncR1} />
        <Wire x1={R1x + 18} y1={pw2N + 8} x2={R1x + 18} y2={RY - 28} color={ncR1} />

        {/* R1 NO (x=242) ← PWR2-L (y=170) → crosses PWR2-N */}
        <Wire x1={R1x - 18} y1={pw2L} x2={R1x - 18} y2={pw2N - 8} color={noR1} />
        <Bridge x={R1x - 18} y={pw2N} color={noR1} />
        <Wire x1={R1x - 18} y1={pw2N + 8} x2={R1x - 18} y2={RY - 28} color={noR1} />

        {/* R2 NC (x=398) ← PWR1-N (y=130) → crosses PWR2-L, PWR2-N */}
        <Wire x1={R2x + 18} y1={pw1N} x2={R2x + 18} y2={pw2L - 8} color={ncR2} />
        <Bridge x={R2x + 18} y={pw2L} color={ncR2} />
        <Wire x1={R2x + 18} y1={pw2L + 8} x2={R2x + 18} y2={pw2N - 8} color={ncR2} />
        <Bridge x={R2x + 18} y={pw2N} color={ncR2} />
        <Wire x1={R2x + 18} y1={pw2N + 8} x2={R2x + 18} y2={RY - 28} color={ncR2} />

        {/* R2 NO (x=362) ← PWR2-N (y=200) → straight down */}
        <Wire x1={R2x - 18} y1={pw2N} x2={R2x - 18} y2={RY - 28} color={noR2} />

        {/* R3 NC (x=638) ← PWR2-L (y=170) → crosses PWR2-N */}
        <Wire x1={R3x + 18} y1={pw2L} x2={R3x + 18} y2={pw2N - 8} color={ncR3} />
        <Bridge x={R3x + 18} y={pw2N} color={ncR3} />
        <Wire x1={R3x + 18} y1={pw2N + 8} x2={R3x + 18} y2={RY - 28} color={ncR3} />

        {/* R3 NO (x=602) ← PWR1-L (y=100) → crosses PWR1-N, PWR2-L, PWR2-N */}
        <Wire x1={R3x - 18} y1={pw1L} x2={R3x - 18} y2={pw1N - 8} color={noR3} />
        <Bridge x={R3x - 18} y={pw1N} color={noR3} />
        <Wire x1={R3x - 18} y1={pw1N + 8} x2={R3x - 18} y2={pw2L - 8} color={noR3} />
        <Bridge x={R3x - 18} y={pw2L} color={noR3} />
        <Wire x1={R3x - 18} y1={pw2L + 8} x2={R3x - 18} y2={pw2N - 8} color={noR3} />
        <Bridge x={R3x - 18} y={pw2N} color={noR3} />
        <Wire x1={R3x - 18} y1={pw2N + 8} x2={R3x - 18} y2={RY - 28} color={noR3} />

        {/* R4 NC (x=758) ← PWR2-N (y=200) → straight down */}
        <Wire x1={R4x + 18} y1={pw2N} x2={R4x + 18} y2={RY - 28} color={ncR4} />

        {/* R4 NO (x=722) ← PWR1-N (y=130) → crosses PWR2-L, PWR2-N */}
        <Wire x1={R4x - 18} y1={pw1N} x2={R4x - 18} y2={pw2L - 8} color={noR4} />
        <Bridge x={R4x - 18} y={pw2L} color={noR4} />
        <Wire x1={R4x - 18} y1={pw2L + 8} x2={R4x - 18} y2={pw2N - 8} color={noR4} />
        <Bridge x={R4x - 18} y={pw2N} color={noR4} />
        <Wire x1={R4x - 18} y1={pw2N + 8} x2={R4x - 18} y2={RY - 28} color={noR4} />

        {/* ═══ RELAY BOXES ═════════════════════════════════════════════════ */}
        <Relay x={R1x} y={RY} label="R1" energized={r1on} />
        <Relay x={R2x} y={RY} label="R2" energized={r2on} />
        <Relay x={R3x} y={RY} label="R3" energized={r3on} />
        <Relay x={R4x} y={RY} label="R4" energized={r4on} />

        {/* ═══ GPIO BUS (y=325) — runs BELOW relays, no overlap ═══════════
            Each relay coil taps at (rx, RY+28) → drops to gpio bus at y=325
            R5/R6 cutoff coils also connect via vertical drops from their rail positions */}
        {/* Coil wires from changeover relays to GPIO bus */}
        <Wire x1={R1x} y1={RY + 28} x2={R1x} y2={gpioY} color="#f97316" dash />
        <Dot x={R1x} y={gpioY} color="#f97316" />
        <Wire x1={R2x} y1={RY + 28} x2={R2x} y2={gpioY} color="#f97316" dash />
        <Dot x={R2x} y={gpioY} color="#f97316" />
        <Wire x1={R3x} y1={RY + 28} x2={R3x} y2={gpioY} color="#f97316" dash />
        <Dot x={R3x} y={gpioY} color="#f97316" />
        <Wire x1={R4x} y1={RY + 28} x2={R4x} y2={gpioY} color="#f97316" dash />
        <Dot x={R4x} y={gpioY} color="#f97316" />
        {/* R5 coil wire: from R5 (x=150, y=100+14) down to GPIO bus, bridging pw1N, pw2L, pw2N */}
        <Wire x1={150} y1={pw1L + 14} x2={150} y2={pw1N - 8} color="#f97316" dash />
        <Bridge x={150} y={pw1N} color="#f97316" />
        <Wire x1={150} y1={pw1N + 8} x2={150} y2={pw2L - 8} color="#f97316" dash />
        <Bridge x={150} y={pw2L} color="#f97316" />
        <Wire x1={150} y1={pw2L + 8} x2={150} y2={pw2N - 8} color="#f97316" dash />
        <Bridge x={150} y={pw2N} color="#f97316" />
        <Wire x1={150} y1={pw2N + 8} x2={150} y2={gpioY} color="#f97316" dash />
        <Dot x={150} y={gpioY} color="#f97316" />
        {/* R6 coil wire: from R6 (x=850, y=170+14) down to GPIO bus, bridging pw2N */}
        <Wire x1={850} y1={pw2L + 14} x2={850} y2={pw2N - 8} color="#f97316" dash />
        <Bridge x={850} y={pw2N} color="#f97316" />
        <Wire x1={850} y1={pw2N + 8} x2={850} y2={gpioY} color="#f97316" dash />
        <Dot x={850} y={gpioY} color="#f97316" />
        {/* Horizontal GPIO bus — extended to include R5 and R6 */}
        <Wire x1={150} y1={gpioY} x2={850} y2={gpioY} color="#f97316" dash />
        <Lbl x={500} y={gpioY - 8} txt="GPIO Control Bus (R1–R6)" color="#f97316" size={9} />

        {/* RPi vertical drop from GPIO bus centre */}
        <Wire x1={500} y1={gpioY} x2={500} y2={348} color="#f97316" dash />
        <Dot x={500} y={gpioY} color="#f97316" />
        <RPi x={500} y={370} />

        {/* ═══ COM WIRES → LOAD RAILS ═════════════════════════════════════
            R1 COM → PWR1 Load-L rail (left side)
            R2 COM → PWR1 Load-N rail (left side, routes LEFT to avoid centre)
            R3 COM → PWR2 Load-L rail (right side)
            R4 COM → PWR2 Load-N rail (right side, routes RIGHT to avoid centre) */}

        {/* R1 COM (x=260) → down to Load-L rail at y=410 (left side)
            Needs to bridge over GPIO bus at y=325 */}
        <Wire x1={R1x} y1={RY + 28} x2={R1x} y2={gpioY - 8} color={comR1} />
        <Bridge x={R1x} y={gpioY} color={comR1} />
        <Wire x1={R1x} y1={gpioY + 8} x2={R1x} y2={ldL} color={comR1} />
        <Dot x={R1x} y={ldL} color={comR1} />

        {/* R2 COM (x=380) → route LEFT at y=305, then down to Load-N at y=560
            Goes to x=175, then vertical down — entirely left of RPi area.
            Bridges GPIO bus */}
        <Wire x1={R2x} y1={RY + 28} x2={R2x} y2={305} color={comR2} />
        <Wire x1={R2x} y1={305} x2={175} y2={305} color={comR2} />
        <Wire x1={175} y1={305} x2={175} y2={gpioY - 8} color={comR2} />
        <Bridge x={175} y={gpioY} color={comR2} />
        <Wire x1={175} y1={gpioY + 8} x2={175} y2={ldN} color={comR2} />
        <Dot x={175} y={ldN} color={comR2} />

        {/* R3 COM (x=620) → down to Load-L rail at y=410 (right side)
            Bridges GPIO bus */}
        <Wire x1={R3x} y1={RY + 28} x2={R3x} y2={gpioY - 8} color={comR3} />
        <Bridge x={R3x} y={gpioY} color={comR3} />
        <Wire x1={R3x} y1={gpioY + 8} x2={R3x} y2={ldL} color={comR3} />
        <Dot x={R3x} y={ldL} color={comR3} />

        {/* R4 COM (x=740) → route RIGHT at y=305, then down to Load-N at y=560
            Goes to x=825, then vertical down — entirely right of RPi area.
            Bridges GPIO bus */}
        <Wire x1={R4x} y1={RY + 28} x2={R4x} y2={305} color={comR4} />
        <Wire x1={R4x} y1={305} x2={825} y2={305} color={comR4} />
        <Wire x1={825} y1={305} x2={825} y2={gpioY - 8} color={comR4} />
        <Bridge x={825} y={gpioY} color={comR4} />
        <Wire x1={825} y1={gpioY + 8} x2={825} y2={ldN} color={comR4} />
        <Dot x={825} y={ldN} color={comR4} />

        {/* ═══ PWR1 LOAD GROUP (left side, x=175-370) ═════════════════════ */}
        {/* L rail at y=410 */}
        <Wire x1={175} y1={ldL} x2={370} y2={ldL} color={comR1} />
        <Lbl x={272} y={ldL - 8} txt="PWR1 Load" color="#3b82f6" size={10} bold />
        {/* N rail at y=560 */}
        <Wire x1={175} y1={ldN} x2={370} y2={ldN} color={comR2} />

        {/* Socket at x=230 */}
        <Wire x1={230} y1={ldL} x2={230} y2={ldY - 13} color={comR1} />
        <Dot x={230} y={ldL} color={comR1} />
        <Socket x={230} y={ldY} on={ld1on} />
        <Wire x1={230} y1={ldY + 13} x2={230} y2={ldN} color={comR2} />
        <Dot x={230} y={ldN} color={comR2} />

        {/* Bulb at x=330 */}
        <Wire x1={330} y1={ldL} x2={330} y2={ldY - 12} color={comR1} />
        <Dot x={330} y={ldL} color={comR1} />
        <Bulb x={330} y={ldY} label="Bulb" on={ld1on} />
        <Wire x1={330} y1={ldY + 12} x2={330} y2={ldN} color={comR2} />
        <Dot x={330} y={ldN} color={comR2} />

        {/* ═══ PWR2 LOAD GROUP (right side, x=630-825) ════════════════════ */}
        {/* L rail at y=410 */}
        <Wire x1={630} y1={ldL} x2={825} y2={ldL} color={comR3} />
        <Lbl x={728} y={ldL - 8} txt="PWR2 Load" color="#8b5cf6" size={10} bold />
        {/* N rail at y=560 */}
        <Wire x1={630} y1={ldN} x2={825} y2={ldN} color={comR4} />

        {/* Bulb 1 at x=680 */}
        <Wire x1={680} y1={ldL} x2={680} y2={ldY - 12} color={comR3} />
        <Dot x={680} y={ldL} color={comR3} />
        <Bulb x={680} y={ldY} label="Bulb 1" on={ld2on} />
        <Wire x1={680} y1={ldY + 12} x2={680} y2={ldN} color={comR4} />
        <Dot x={680} y={ldN} color={comR4} />

        {/* Bulb 2 at x=780 */}
        <Wire x1={780} y1={ldL} x2={780} y2={ldY - 12} color={comR3} />
        <Dot x={780} y={ldL} color={comR3} />
        <Bulb x={780} y={ldY} label="Bulb 2" on={ld2on} />
        <Wire x1={780} y1={ldY + 12} x2={780} y2={ldN} color={comR4} />
        <Dot x={780} y={ldN} color={comR4} />

        {/* ═══ BUZZER (bottom, connected to RPi) ══════════════════════════ */}
        <Wire x1={500} y1={394} x2={500} y2={615} color="#facc15" dash />
        <Wire x1={500} y1={615} x2={170} y2={615} color="#facc15" dash />
        <Buzzer x={170} y={640} />
        <Wire x1={170} y1={615} x2={170} y2={629} color="#facc15" dash />

        {/* ═══ LEGEND ═════════════════════════════════════════════════════ */}
        <rect x={640} y={596} width={340} height={90} rx={5} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
        <Lbl x={810} y={610} txt="LEGEND" color="#52525b" size={9} bold />

        <line x1={652} y1={622} x2={672} y2={622} stroke="#22c55e" strokeWidth={2} />
        <Lbl x={680} y={625} txt="PS1 supply (PWR1)" color="#71717a" size={9} anchor="start" />

        <line x1={652} y1={636} x2={672} y2={636} stroke="#a855f7" strokeWidth={2} />
        <Lbl x={680} y={639} txt="PS2 supply (PWR2)" color="#71717a" size={9} anchor="start" />

        <line x1={652} y1={650} x2={672} y2={650} stroke="#f97316" strokeWidth={2} strokeDasharray="5,4" />
        <Lbl x={680} y={653} txt="GPIO / control" color="#71717a" size={9} anchor="start" />

        <line x1={832} y1={622} x2={852} y2={622} stroke="#3b82f6" strokeWidth={2} />
        <Lbl x={860} y={625} txt="PWR1 load out" color="#71717a" size={9} anchor="start" />

        <line x1={832} y1={636} x2={852} y2={636} stroke="#8b5cf6" strokeWidth={2} />
        <Lbl x={860} y={639} txt="PWR2 load out" color="#71717a" size={9} anchor="start" />

        <line x1={832} y1={650} x2={852} y2={650} stroke="#ef4444" strokeWidth={2} />
        <Lbl x={860} y={653} txt="Cutoff (R5/R6)" color="#71717a" size={9} anchor="start" />

        {/* Bridge example in legend */}
        <g transform="translate(652, 664)">
          <line x1={0} y1={0} x2={4} y2={0} stroke="#71717a" strokeWidth={2} />
          <path d="M4,0 a4,4 0 0,0 8,0" fill="none" stroke="#71717a" strokeWidth={2} />
          <line x1={12} y1={0} x2={20} y2={0} stroke="#71717a" strokeWidth={2} />
        </g>
        <Lbl x={680} y={667} txt="Wire bridge (no join)" color="#71717a" size={9} anchor="start" />

      </svg>
    </div>
  )
}
