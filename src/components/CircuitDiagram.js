'use client'

const W = ({ x1, y1, x2, y2, color = '#3f3f46', dash, width = 2 }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2}
    stroke={color} strokeWidth={width}
    strokeDasharray={dash ? '5,4' : undefined} />
)

const Lbl = ({ x, y, txt, color = '#71717a', size = 10, anchor = 'middle', bold }) => (
  <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={color}
    fontFamily="monospace" fontWeight={bold ? 'bold' : 'normal'}>{txt}</text>
)

const Dot = ({ x, y, color }) => <circle cx={x} cy={y} r={3.5} fill={color} />

function Sw({ x, y, label, color }) {
  return (
    <g>
      <W x1={x - 14} y1={y} x2={x - 6} y2={y} color={color} />
      <circle cx={x - 6} cy={y} r={2.5} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={x + 6} cy={y} r={2.5} fill="none" stroke={color} strokeWidth={1.5} />
      <line x1={x - 6} y1={y} x2={x + 4} y2={y - 9} stroke={color} strokeWidth={2} />
      <W x1={x + 6} y1={y} x2={x + 14} y2={y} color={color} />
      <Lbl x={x} y={y - 13} txt={label} color="#a3e635" size={10} />
    </g>
  )
}

function Pzem({ x, y, color }) {
  return (
    <g>
      <W x1={x - 18} y1={y} x2={x - 13} y2={y} color={color} />
      <circle cx={x} cy={y} r={13} fill="#0c1a2e" stroke="#38bdf8" strokeWidth={1.5} />
      {[0, 1, 2].map(i => (
        <path key={i} d={`M${x - 8 + i * 6} ${y} a3 3 0 0 1 6 0`} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
      ))}
      <W x1={x + 13} y1={y} x2={x + 18} y2={y} color={color} />
      <Lbl x={x} y={y - 19} txt="PZEM" color="#38bdf8" size={9} />
    </g>
  )
}

/* Relay box:
   - NC terminal: top-right  (rx+16, RY-26)
   - NO terminal: top-left   (rx-16, RY-26)
   - COM terminal: btm-ctr   (rx,    RY+26)
   - COIL terminal: left-mid (rx-24, RY)      ← GPIO connects here
*/
function Relay({ x, y, label, energized }) {
  const bg = energized ? '#1e3a5f' : '#18181b'
  const bd = energized ? '#3b82f6' : '#3f3f46'
  const tc = energized ? '#93c5fd' : '#71717a'
  return (
    <g>
      <rect x={x - 24} y={y - 26} width={48} height={52} rx={4}
        fill={bg} stroke={bd} strokeWidth={energized ? 2 : 1.5} />
      {energized
        ? <line x1={x - 13} y1={y - 4} x2={x + 13} y2={y - 4} stroke="#3b82f6" strokeWidth={1.5} />
        : <line x1={x - 13} y1={y - 12} x2={x + 5}  y2={y - 4} stroke="#52525b" strokeWidth={1.5} />
      }
      <Lbl x={x} y={y + 6}  txt={label} color={energized ? '#60a5fa' : '#e4e4e7'} size={12} bold />
      <Lbl x={x} y={y + 20} txt="COM"   color={tc} size={8} />
      <Lbl x={x - 15} y={y - 17} txt="NO" color="#4ade80" size={8} />
      <Lbl x={x + 15} y={y - 17} txt="NC" color={tc}      size={8} />
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
      <Lbl x={x} y={y + 22} txt={label} color={c} size={10} />
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
      <Lbl x={x} y={y + 24} txt="Socket" color={c} size={10} />
    </g>
  )
}

function PS({ x, y, label, active }) {
  const c = active ? '#22c55e' : '#52525b'
  return (
    <g>
      <rect x={x - 34} y={y - 17} width={68} height={34} rx={6}
        fill={active ? '#14532d' : '#18181b'} stroke={c} strokeWidth={active ? 2 : 1.5} />
      <Lbl x={x} y={y - 3}  txt={label}  color={c} size={13} bold />
      <Lbl x={x} y={y + 10} txt={active ? '● ACTIVE' : '○ STANDBY'} color={c} size={8} />
    </g>
  )
}

function RPi({ x, y }) {
  return (
    <g>
      <rect x={x - 38} y={y - 22} width={76} height={44} rx={5}
        fill="#1c1917" stroke="#78716c" strokeWidth={1.5} />
      <Lbl x={x} y={y - 8}  txt="RPi 4B" color="#fb923c" size={11} bold />
      <Lbl x={x} y={y + 5} txt="S1 / GPIO" color="#78716c" size={9} />
      {[0,1,2,3,4,5].map(i => (
        <circle key={i} cx={x - 18 + i * 7} cy={y + 16} r={2.5}
          fill={i % 2 === 0 ? '#f97316' : '#78716c'} />
      ))}
    </g>
  )
}

function Buzzer({ x, y }) {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="none" stroke="#facc15" strokeWidth={1.5} />
      {[0,1,2].map(i => (
        <path key={i} d={`M${x - 6 + i * 5} ${y + 1} a2.5 2.5 0 0 1 5 0`}
          fill="none" stroke="#facc15" strokeWidth={1.5} />
      ))}
      <Lbl x={x} y={y + 22} txt="BA1" color="#facc15" size={10} />
    </g>
  )
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function CircuitDiagram({
  relays = { ps1_l: false, ps1_n: false, ps2_l: false, ps2_n: false },
  activeSource = 1,
}) {
  const r1on = relays.ps1_l
  const r2on = relays.ps1_n
  const r3on = relays.ps2_l
  const r4on = relays.ps2_n

  const ps1 = activeSource === 1
  const ps2 = activeSource === 2

  const c1  = ps1 ? '#22c55e' : '#3f3f46'
  const c2  = ps2 ? '#a855f7' : '#3f3f46'
  const dim = '#27272a'

  // Determine active path colours
  const ncR1 = (!r1on && ps1) ? c1 : dim
  const ncR2 = (!r2on && ps1) ? c1 : dim
  const ncR3 = (!r3on && ps2) ? c2 : dim
  const ncR4 = (!r4on && ps2) ? c2 : dim
  const noR1 = (r1on  && ps2) ? c2 : dim
  const noR2 = (r2on  && ps2) ? c2 : dim
  const noR3 = (r3on  && ps1) ? c1 : dim
  const noR4 = (r4on  && ps1) ? c1 : dim

  const comR1 = (ncR1 !== dim || noR1 !== dim) ? '#3b82f6' : dim
  const comR2 = (ncR2 !== dim || noR2 !== dim) ? '#3b82f6' : dim
  const comR3 = (ncR3 !== dim || noR3 !== dim) ? '#8b5cf6' : dim
  const comR4 = (ncR4 !== dim || noR4 !== dim) ? '#8b5cf6' : dim

  const ld1on = comR1 !== dim
  const ld2on = comR3 !== dim

  /* ── fixed geometry ─────────────────────────────────────────────────────
     Power rails (y):  pw1L=90  pw2L=113  pw1N=145  pw2N=168
     Relay row:        RY=235  (boxes span y=209-261)
     Relay x:          R1=240  R2=320  R3=540  R4=620
     NC terminal:      (rx+16, 209)   NO terminal: (rx-16, 209)
     COM terminal:     (rx, 261)      COIL port:   (rx-24, RY)  ← GPIO

     Load L rails:     y=305   PWR1: x=165-355   PWR2: x=465-645
     Load N rails:     y=455   PWR1: x=165-360   PWR2: x=460-645
     Loads:            y=378   Socket(x=210) Bulb(x=295) | Bulb1(x=505) Bulb2(x=595)

     Centre corridor:  x=355-465  (no loads — clean vertical path for GPIO)
     RPi:              x=410, y=395 (centre corridor, between load groups)
     GPIO bus:         y=235 horizontal  x=216-596  (inside relay row height)
  ──────────────────────────────────────────────────────────────────────── */
  const RY = 235
  const R1x=240, R2x=320, R3x=540, R4x=620
  const pw1L=90, pw2L=113, pw1N=145, pw2N=168

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 overflow-x-auto">
      <div className="mb-3">
        <span className="text-zinc-400 text-xs font-medium uppercase tracking-widest">Circuit View</span>
        <h2 className="text-white text-base font-bold">Full Circuit Diagram</h2>
        <p className="text-zinc-500 text-xs mt-0.5">
          NC = home source (default) · NO = backup source · COM → load
        </p>
      </div>

      <svg viewBox="0 0 860 540" className="w-full" style={{ minWidth: '700px', maxHeight: '520px' }}>
        {/* Grid */}
        <defs>
          <pattern id="cg" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0L0 0 0 20" fill="none" stroke="#1a1a1a" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="860" height="540" fill="url(#cg)" />

        {/* Section labels */}
        <Lbl x={205} y={20} txt="PWR 1" color="#52525b" size={13} bold />
        <Lbl x={655} y={20} txt="PWR 2" color="#52525b" size={13} bold />

        {/* ── POWER SOURCES ──────────────────────────────────────────────── */}
        <PS x={100} y={55} label="PS1" active={ps1} />
        <PS x={760} y={55} label="PS2" active={ps2} />

        {/* PS1 drops to both its rails */}
        <W x1={100} y1={72} x2={100} y2={pw1L} color={c1} />
        <W x1={100} y1={pw1L} x2={100} y2={pw1N} color={c1} />

        {/* PS2 drops to both its rails */}
        <W x1={760} y1={72} x2={760} y2={pw2L} color={c2} />
        <W x1={760} y1={pw2L} x2={760} y2={pw2N} color={c2} />

        {/* ── RAIL SIDE LABELS ───────────────────────────────────────────── */}
        <Lbl x={60} y={pw1L+4} txt="PWR1-L" color={c1} size={9} anchor="end" />
        <Lbl x={60} y={pw2L+4} txt="PWR2-L" color={c2} size={9} anchor="end" />
        <Lbl x={60} y={pw1N+4} txt="PWR1-N" color={c1} size={9} anchor="end" />
        <Lbl x={60} y={pw2N+4} txt="PWR2-N" color={c2} size={9} anchor="end" />

        {/* ── PWR1-L RAIL  y=90  ─── SW1 ─── PZEM ─── R1-NC ─── R3-NO ── */}
        <W x1={100} y1={pw1L} x2={138} y2={pw1L} color={c1} />
        <Sw x={155} y={pw1L} label="SW1" color={c1} />
        <W x1={169} y1={pw1L} x2={195} y2={pw1L} color={c1} />
        <Pzem x={213} y={pw1L} color={c1} />
        {/* PZEM right → R1-NC junction */}
        <W x1={226} y1={pw1L} x2={R1x+16} y2={pw1L} color={c1} />
        {/* R1-NC → continue right → R3-NO */}
        <W x1={R1x+16} y1={pw1L} x2={R3x-16} y2={pw1L} color={c1} />
        <Dot x={R1x+16} y={pw1L} color={c1} />
        <Dot x={R3x-16} y={pw1L} color={c1} />

        {/* ── PWR2-L RAIL  y=113  ─── R1-NO ─── R3-NC ─── SW2 ─── PS2 ── */}
        <W x1={760} y1={pw2L} x2={680} y2={pw2L} color={c2} />
        <Sw x={663} y={pw2L} label="SW2" color={c2} />
        <W x1={649} y1={pw2L} x2={R3x+16} y2={pw2L} color={c2} />
        <W x1={R3x+16} y1={pw2L} x2={R1x-16} y2={pw2L} color={c2} />
        <Dot x={R3x+16} y={pw2L} color={c2} />
        <Dot x={R1x-16} y={pw2L} color={c2} />

        {/* ── PWR1-N RAIL  y=145  ─── R2-NC ─── R4-NO ────────────────── */}
        <W x1={100} y1={pw1N} x2={R2x+16} y2={pw1N} color={c1} />
        <W x1={R2x+16} y1={pw1N} x2={R4x-16} y2={pw1N} color={c1} />
        <Dot x={R2x+16} y={pw1N} color={c1} />
        <Dot x={R4x-16} y={pw1N} color={c1} />

        {/* ── PWR2-N RAIL  y=168  ─── R2-NO ─── R4-NC ────────────────── */}
        <W x1={760} y1={pw2N} x2={R4x+16} y2={pw2N} color={c2} />
        <W x1={R4x+16} y1={pw2N} x2={R2x-16} y2={pw2N} color={c2} />
        <Dot x={R4x+16} y={pw2N} color={c2} />
        <Dot x={R2x-16} y={pw2N} color={c2} />

        {/* ── VERTICAL DROPS: rail → relay terminal ───────────────────── */}
        {/* R1 NC ← PWR1-L */}
        <W x1={R1x+16} y1={pw1L} x2={R1x+16} y2={RY-26} color={ncR1} />
        {/* R1 NO ← PWR2-L */}
        <W x1={R1x-16} y1={pw2L} x2={R1x-16} y2={RY-26} color={noR1} />
        {/* R2 NC ← PWR1-N */}
        <W x1={R2x+16} y1={pw1N} x2={R2x+16} y2={RY-26} color={ncR2} />
        {/* R2 NO ← PWR2-N */}
        <W x1={R2x-16} y1={pw2N} x2={R2x-16} y2={RY-26} color={noR2} />
        {/* R3 NC ← PWR2-L */}
        <W x1={R3x+16} y1={pw2L} x2={R3x+16} y2={RY-26} color={ncR3} />
        {/* R3 NO ← PWR1-L */}
        <W x1={R3x-16} y1={pw1L} x2={R3x-16} y2={RY-26} color={noR3} />
        {/* R4 NC ← PWR2-N */}
        <W x1={R4x+16} y1={pw2N} x2={R4x+16} y2={RY-26} color={ncR4} />
        {/* R4 NO ← PWR1-N */}
        <W x1={R4x-16} y1={pw1N} x2={R4x-16} y2={RY-26} color={noR4} />

        {/* ── RELAY BOXES ─────────────────────────────────────────────── */}
        <Relay x={R1x} y={RY} label="R1" energized={r1on} />
        <Relay x={R2x} y={RY} label="R2" energized={r2on} />
        <Relay x={R3x} y={RY} label="R3" energized={r3on} />
        <Relay x={R4x} y={RY} label="R4" energized={r4on} />

        {/* ── GPIO BUS — horizontal at y=235 (INSIDE relay row height)
             Coil port = left side of each relay box (rx-24, RY)
             RPi vertical at x=410 passes through CENTRE CORRIDOR (x=355-465)
             — no load wires in this corridor, zero overlap ──────────── */}
        {/* horizontal bus */}
        <W x1={R1x-24} y1={RY} x2={R4x-24} y2={RY} color="#f97316" dash />
        {/* coil tap dots */}
        <Dot x={R1x-24} y={RY} color="#f97316" />
        <Dot x={R2x-24} y={RY} color="#f97316" />
        <Dot x={R3x-24} y={RY} color="#f97316" />
        <Dot x={R4x-24} y={RY} color="#f97316" />
        {/* RPi vertical — through centre corridor x=410 */}
        <W x1={410} y1={RY} x2={410} y2={373} color="#f97316" dash />
        {/* RPi block */}
        <RPi x={410} y={395} />
        <Lbl x={410} y={435} txt="← centre corridor (no load wires)" color="#3f3f46" size={9} />

        {/* ── COM WIRES: R1 & R3 go straight down to L-rails ──────────── */}
        {/* R1 COM → PWR1 L load rail */}
        <W x1={R1x} y1={RY+26} x2={R1x} y2={305} color={comR1} />
        <Dot x={R1x} y={305} color={comR1} />

        {/* R3 COM → PWR2 L load rail */}
        <W x1={R3x} y1={RY+26} x2={R3x} y2={305} color={comR3} />
        <Dot x={R3x} y={305} color={comR3} />

        {/* R2 COM → routes to RIGHT edge → down to PWR1 N rail
            stays within x=320-360, entirely left of centre corridor ── */}
        <W x1={R2x} y1={RY+26} x2={R2x} y2={278} color={comR2} />
        <W x1={R2x} y1={278}   x2={360}  y2={278} color={comR2} />
        <W x1={360} y1={278}   x2={360}  y2={455} color={comR2} />
        <Dot x={360} y={455} color={comR2} />

        {/* R4 COM → routes to LEFT edge → down to PWR2 N rail
            stays within x=460-620, entirely right of centre corridor ─ */}
        <W x1={R4x} y1={RY+26} x2={R4x} y2={278} color={comR4} />
        <W x1={R4x} y1={278}   x2={460}  y2={278} color={comR4} />
        <W x1={460} y1={278}   x2={460}  y2={455} color={comR4} />
        <Dot x={460} y={455} color={comR4} />

        {/* ── PWR1 LOAD ────────────────────────────────────────────────── */}
        {/* L rail  y=305, x=165-355 */}
        <W x1={165} y1={305} x2={355} y2={305} color={comR1} />
        {/* N rail  y=455, x=165-360 */}
        <W x1={165} y1={455} x2={360} y2={455} color={comR2} />
        {/* label */}
        <Lbl x={262} y={298} txt="PWR1 Load" color="#3b82f6" size={9} bold />

        {/* Socket at x=210 */}
        <W x1={210} y1={305} x2={210} y2={365} color={comR1} />
        <Socket x={210} y={378} on={ld1on} />
        <W x1={210} y1={391} x2={210} y2={455} color={comR2} />

        {/* Bulb at x=305 */}
        <W x1={305} y1={305} x2={305} y2={366} color={comR1} />
        <Bulb x={305} y={378} label="Bulb" on={ld1on} />
        <W x1={305} y1={390} x2={305} y2={455} color={comR2} />

        {/* ── PWR2 LOAD ────────────────────────────────────────────────── */}
        {/* L rail  y=305, x=465-645 */}
        <W x1={465} y1={305} x2={645} y2={305} color={comR3} />
        {/* N rail  y=455, x=460-645 */}
        <W x1={460} y1={455} x2={645} y2={455} color={comR4} />
        {/* label */}
        <Lbl x={555} y={298} txt="PWR2 Load" color="#8b5cf6" size={9} bold />

        {/* Bulb1 at x=505 */}
        <W x1={505} y1={305} x2={505} y2={366} color={comR3} />
        <Bulb x={505} y={378} label="Bulb 1" on={ld2on} />
        <W x1={505} y1={390} x2={505} y2={455} color={comR4} />

        {/* Bulb2 at x=595 */}
        <W x1={595} y1={305} x2={595} y2={366} color={comR3} />
        <Bulb x={595} y={378} label="Bulb 2" on={ld2on} />
        <W x1={595} y1={390} x2={595} y2={455} color={comR4} />

        {/* ── BUZZER BA1 ───────────────────────────────────────────────── */}
        <Buzzer x={155} y={500} />
        <W x1={155} y1={489} x2={155} y2={470} color="#facc15" dash />
        <W x1={155} y1={470} x2={388} y2={470} color="#facc15" dash />
        <W x1={388} y1={470} x2={388} y2={417} color="#facc15" dash />

        {/* ── LEGEND ───────────────────────────────────────────────────── */}
        <rect x={620} y={460} width={228} height={72} rx={4} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
        <Lbl x={734} y={474} txt="LEGEND" color="#52525b" size={9} bold />
        <line x1={628} y1={484} x2={648} y2={484} stroke="#22c55e" strokeWidth={2} />
        <Lbl x={700} y={487} txt="PWR1 supply" color="#52525b" size={9} />
        <line x1={628} y1={497} x2={648} y2={497} stroke="#a855f7" strokeWidth={2} />
        <Lbl x={700} y={500} txt="PWR2 supply" color="#52525b" size={9} />
        <line x1={628} y1={510} x2={648} y2={510} stroke="#3b82f6" strokeWidth={2} />
        <Lbl x={700} y={513} txt="PWR1 load out" color="#52525b" size={9} />
        <line x1={628} y1={523} x2={648} y2={523} stroke="#8b5cf6" strokeWidth={2} />
        <Lbl x={700} y={526} txt="PWR2 load out" color="#52525b" size={9} />

      </svg>
    </div>
  )
}
