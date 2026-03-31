# GridSentinel — Flask API Reference

Base URL: `http://<rpi-ip>:5000`

Find the RPi IP with: `hostname -I` on the RPi terminal.
Both the RPi and the device running the Next.js dashboard must be on the same local network.

---

## GET /api/ping
Health check. Returns `{ "ok": true }` if server is alive.

---

## GET /api/status
Poll this every 2-3 seconds for live data.

### Response
```json
{
  "active_source": 1,
  "mode": "auto",
  "timestamp": "2025-01-01T12:00:00",

  "ps1": {
    "sensor_connected": true,
    "error": null,
    "voltage": 231.4,
    "current": 9.821,
    "power": 2195.3,
    "energy": 4521,
    "frequency": 50.1,
    "pf": 0.97,
    "alarm": false
  },

  "ps2": {
    "sensor_connected": false,
    "error": "could not open port /dev/ttyS0",
    "voltage": null,
    "current": null,
    "power": null,
    "energy": null,
    "frequency": null,
    "pf": null,
    "alarm": false
  },

  "relays": {
    "ps1_l":   false,
    "ps1_n":   false,
    "ps2_l":   false,
    "ps2_n":   false,
    "ps1_cut": false,
    "ps2_cut": false
  },

  "cutoff": {
    "ps1": false,
    "ps2": false
  }
}
```

### Key fields
| Field | Meaning |
|---|---|
| `active_source` | Which source is currently supplying load (1 or 2) |
| `mode` | `auto` = RPi decides switches, `manual` = operator controls |
| `ps1.sensor_connected` | True if PZEM on /dev/ttyUSB0 is responding |
| `ps2.sensor_connected` | True if PZEM on /dev/ttyS0 (GPIO 14/15) is responding |
| `ps1.error` | null if OK, error string if PZEM not found/failing |
| `relays.ps1_l` | R1 state — true = energized = NO path = PWR2 feeding PS1 load L |
| `relays.ps1_n` | R2 state — true = energized = NO path = PWR2 feeding PS1 load N |
| `relays.ps2_l` | R3 state — true = energized = NO path = PWR1 feeding PS2 load L |
| `relays.ps2_n` | R4 state — true = energized = NO path = PWR1 feeding PS2 load N |
| `relays.ps1_cut` | R5 state — true = PWR1 line physically cut (overload) |
| `relays.ps2_cut` | R6 state — true = PWR2 line physically cut (overload) |
| `cutoff.ps1` | Same as relays.ps1_cut — duplicate for convenience |
| `cutoff.ps2` | Same as relays.ps2_cut — duplicate for convenience |

---

## POST /api/switch
Switch active power source.

### Body
```json
{ "source": 2 }
```
`source` = 1 or 2

### Response
```json
{ "ok": true, "active_source": 2 }
```

---

## POST /api/mode
Set switching mode.

### Body
```json
{ "mode": "manual" }
```
`mode` = `"auto"` or `"manual"`

### Response
```json
{ "ok": true, "mode": "manual" }
```

---

## POST /api/cutoff
Cut or restore a power line via R5 (PWR1) or R6 (PWR2).

### Body
```json
{ "source": 1, "cut": true }
```
- `source` = 1 (R5 / PWR1) or 2 (R6 / PWR2)
- `cut` = true (disconnect line) or false (restore line)

### Response
```json
{ "ok": true, "source": 1, "cut": true }
```

---

## POST /api/relay
Direct control of any relay R1-R6.
- **R1-R4** = changeover relays — prefer `/api/switch` instead
- **R5-R6** = cutoff relays — prefer `/api/cutoff` instead

### Body
```json
{ "relay": "R1", "on": true }
```
`relay` = `"R1"` | `"R2"` | `"R3"` | `"R4"` | `"R5"` | `"R6"`

### Response
```json
{ "ok": true, "relay": "R1", "on": true }
```

---

## Relay behaviour summary

### Changeover relays R1-R4 (source switching)
- De-energized (on=false) → NC path active → home source connected
- Energized (on=true) → NO path active → backup source connected
- R1 NC ← PWR1-L,  R1 NO ← PWR2-L,  R1 COM → PS1 load L
- R2 NC ← PWR1-N,  R2 NO ← PWR2-N,  R2 COM → PS1 load N
- R3 NC ← PWR2-L,  R3 NO ← PWR1-L,  R3 COM → PS2 load L
- R4 NC ← PWR2-N,  R4 NO ← PWR1-N,  R4 COM → PS2 load N

### Cutoff relays R5-R6 (overload protection)
- R5 GPIO 24 — controls PWR1 line. COM=PWR1, NC=load, NO=nowhere
- R6 GPIO 25 — controls PWR2 line. COM=PWR2, NC=load, NO=nowhere
- These are ACTIVE LOW — GPIO LOW = relay energizes = NC opens = power cut
- GPIO floated (INPUT) = board pull-up releases relay = power flows
- Auto-cutoff triggers at 4000W when in auto mode

### GPIO pin map
| Relay | GPIO | Role |
|---|---|---|
| R1 | 17 | PWR1 L-wire changeover |
| R2 | 27 | PWR1 N-wire changeover |
| R3 | 22 | PWR2 L-wire changeover |
| R4 | 23 | PWR2 N-wire changeover |
| R5 | 24 | PWR1 cutoff |
| R6 | 25 | PWR2 cutoff |

---

## PZEM sensor states
The UI must handle 3 cases per source:

| sensor_connected | error | Display |
|---|---|---|
| true | null | Show live readings |
| false | "could not open port..." | Show "Sensor offline" badge |
| false | any string | Show error string as tooltip |

### PZEM connections
- PS1 → `/dev/ttyUSB0` (USB adapter)
- PS2 → `/dev/ttyS0` (hardware UART — GPIO 14 TX, GPIO 15 RX)

PS2 will show `sensor_connected=false` until the PZEM module is physically
wired to GPIO 14/15. Once wired, it is detected automatically — no server
restart needed.
