# GridSentinel — Flask API Reference

Base URL: `http://<rpi-ip>:5000`  (e.g. http://raspberrypi.local:5000)

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
    "error": "could not open port /dev/ttyUSB1",
    "voltage": null,
    "current": null,
    "power": null,
    "energy": null,
    "frequency": null,
    "pf": null,
    "alarm": false
  },

  "relays": {
    "ps1_l": false,
    "ps1_n": false,
    "ps2_l": false,
    "ps2_n": false
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
| `ps2.sensor_connected` | True if PZEM on /dev/ttyUSB1 is responding |
| `ps1.error` | null if OK, error string if PZEM not found/failing |
| `relays.ps1_l` | R1 energized (true = NO path active = backup source on L) |
| `relays.ps1_n` | R2 energized |
| `relays.ps2_l` | R3 energized |
| `relays.ps2_n` | R4 energized |
| `cutoff.ps1` | R5 energized = PWR1 line physically cut |
| `cutoff.ps2` | R6 energized = PWR2 line physically cut |

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
Cut or restore a power line via R5/R6.

### Body
```json
{ "source": 1, "cut": true }
```
- `source` = 1 (R5/PWR1) or 2 (R6/PWR2)
- `cut` = true (disconnect line) or false (restore line)

### Response
```json
{ "ok": true, "source": 1, "cut": true }
```

---

## POST /api/relay
Direct control of a single changeover relay R1-R4.
**Prefer /api/switch** — this is for low-level manual override only.

### Body
```json
{ "relay": "R1", "on": true }
```

### Response
```json
{ "ok": true, "relay": "R1", "on": true }
```

---

## Relay behaviour summary

### Changeover relays R1-R4 (source switching)
- De-energized (on=false) → NC path active → home source connected
- Energized (on=true) → NO path active → backup source connected
- PS1 is home source for R1+R2 (NC = PWR1-L and PWR1-N)
- PS2 is home source for R3+R4 (NC = PWR2-L and PWR2-N)
- R1 NO and R2 NO ← PWR2 (backup for PS1 load)
- R3 NO and R4 NO ← PWR1 (backup for PS2 load)

### Cutoff relays R5-R6 (overload protection)
- R5 controls PWR1 line physically
- R6 controls PWR2 line physically
- cut=true → line disconnected (overload protection)
- cut=false → line restored
- Auto-cutoff triggers at 4000W on active source

---

## PZEM sensor states
The UI must handle 3 cases per source:

| sensor_connected | error | Display |
|---|---|---|
| true | null | Show live readings |
| false | "could not open port..." | "Sensor offline" |
| false | any string | Show error string as tooltip/badge |

PS2 will show sensor_connected=false until /dev/ttyUSB1 is plugged in.
Once plugged in and server detects it, sensor_connected becomes true automatically — no server restart needed.
