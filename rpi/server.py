"""
Flask server for GridSentinel — runs on Raspberry Pi 4B
Exposes REST API for Next.js dashboard to:
  - Read PZEM sensor data (PS1 and PS2)
  - Control relays (R1-R6)
  - Switch active power source
  - Cut/restore power lines (R5/R6)

GPIO map:
    R1 → GPIO 17   PWR1 L changeover
    R2 → GPIO 27   PWR1 N changeover
    R3 → GPIO 22   PWR2 L changeover
    R4 → GPIO 23   PWR2 N changeover
    R5 → GPIO 24   PWR1 cutoff (active LOW, release = INPUT float)
    R6 → GPIO 25   PWR2 cutoff (active LOW, release = INPUT float)

PZEM:
    PS1 → /dev/ttyUSB0   slave addr 0x01
    PS2 → /dev/ttyUSB1   slave addr 0x01  (not yet connected, detected automatically)
"""

import time
import threading
import minimalmodbus
import RPi.GPIO as GPIO
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── Config ────────────────────────────────────────────────────────────────────
PS1_PORT      = '/dev/ttyUSB0'
PS2_PORT      = '/dev/ttyUSB1'
PZEM_ADDR     = 0x01
PZEM_BAUD     = 9600
PZEM_TIMEOUT  = 1.0

RELAY_MAP = {
    'R1': 17,
    'R2': 27,
    'R3': 22,
    'R4': 23,
    'R5': 24,   # PWR1 cutoff
    'R6': 25,   # PWR2 cutoff
}

# Changeover relays R1-R4: active LOW board
CHANGEOVER_ON  = GPIO.LOW
CHANGEOVER_OFF = GPIO.HIGH

# Overload threshold watts — used for auto-cutoff logic
OVERLOAD_WATTS = 4000

# ── State ─────────────────────────────────────────────────────────────────────
state = {
    'active_source': 1,
    'mode': 'auto',          # 'auto' | 'manual'
    'ps1_cutoff': False,     # True = R5 energized = PWR1 cut
    'ps2_cutoff': False,
}

pzem_cache = {
    'ps1': None,   # latest reading dict or None
    'ps2': None,
}

pzem_lock = threading.Lock()

# ── GPIO setup ────────────────────────────────────────────────────────────────
def gpio_setup():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    # Changeover relays — default OFF (NC path = home source active)
    for r in ['R1', 'R2', 'R3', 'R4']:
        GPIO.setup(RELAY_MAP[r], GPIO.OUT, initial=CHANGEOVER_OFF)

    # Cutoff relays — default INPUT = floating = board pull-up = power flows
    GPIO.setup(RELAY_MAP['R5'], GPIO.IN)
    GPIO.setup(RELAY_MAP['R6'], GPIO.IN)


# ── Relay helpers ─────────────────────────────────────────────────────────────
def set_changeover(relay, on: bool):
    GPIO.output(RELAY_MAP[relay], CHANGEOVER_ON if on else CHANGEOVER_OFF)


def cut_power(pin_name: str):
    """Drive pin OUTPUT LOW → relay energizes → NC opens → power cut."""
    GPIO.setup(RELAY_MAP[pin_name], GPIO.OUT)
    GPIO.output(RELAY_MAP[pin_name], GPIO.LOW)


def restore_power(pin_name: str):
    """Set pin INPUT → floating → board pull-up releases relay → power flows."""
    GPIO.setup(RELAY_MAP[pin_name], GPIO.IN)


def switch_to_source(source: int):
    """
    Safe changeover — open current path first, small dead-time, close new path.
    source: 1 or 2
    """
    # Open both paths
    for r in ['R1', 'R2', 'R3', 'R4']:
        set_changeover(r, False)
    time.sleep(0.2)

    if source == 1:
        # PS1 uses NC path → relays OFF (de-energized)
        set_changeover('R1', False)
        set_changeover('R2', False)
    else:
        # PS2 uses NO path of R1/R2 → energize R1+R2
        # PS2 uses NC path of R3/R4 → R3+R4 OFF
        set_changeover('R1', True)
        set_changeover('R2', True)

    state['active_source'] = source


# ── PZEM helpers ──────────────────────────────────────────────────────────────
def open_pzem(port: str):
    dev = minimalmodbus.Instrument(port, PZEM_ADDR)
    dev.serial.baudrate = PZEM_BAUD
    dev.serial.timeout  = PZEM_TIMEOUT
    dev.mode            = minimalmodbus.MODE_RTU
    return dev


def read_pzem(dev) -> dict:
    regs    = dev.read_registers(0x0000, 10, functioncode=4)
    voltage = regs[0] * 0.1
    current = ((regs[2] << 16) | regs[1]) * 0.001
    power   = ((regs[4] << 16) | regs[3]) * 0.1
    energy  = ((regs[6] << 16) | regs[5])
    freq    = regs[7] * 0.1
    pf      = regs[8] * 0.01
    alarm   = bool(regs[9])
    return {
        'voltage':  round(voltage, 1),
        'current':  round(current, 3),
        'power':    round(power, 1),
        'energy':   energy,
        'frequency': round(freq, 1),
        'pf':       round(pf, 2),
        'alarm':    alarm,
    }


# ── Background polling thread ─────────────────────────────────────────────────
def poll_pzem():
    ps1_dev = None
    ps2_dev = None

    while True:
        # PS1
        try:
            if ps1_dev is None:
                ps1_dev = open_pzem(PS1_PORT)
            data = read_pzem(ps1_dev)
            with pzem_lock:
                pzem_cache['ps1'] = {**data, 'sensor_connected': True, 'error': None}

            # Auto overload cutoff
            if state['mode'] == 'auto' and data['power'] > OVERLOAD_WATTS:
                if state['active_source'] == 1 and not state['ps1_cutoff']:
                    cut_power('R5')
                    state['ps1_cutoff'] = True

        except Exception as e:
            ps1_dev = None
            with pzem_lock:
                pzem_cache['ps1'] = {
                    'sensor_connected': False,
                    'error': str(e),
                    'voltage': None, 'current': None, 'power': None,
                    'energy': None, 'frequency': None, 'pf': None, 'alarm': False,
                }

        # PS2
        try:
            if ps2_dev is None:
                ps2_dev = open_pzem(PS2_PORT)
            data = read_pzem(ps2_dev)
            with pzem_lock:
                pzem_cache['ps2'] = {**data, 'sensor_connected': True, 'error': None}

            if state['mode'] == 'auto' and data['power'] > OVERLOAD_WATTS:
                if state['active_source'] == 2 and not state['ps2_cutoff']:
                    cut_power('R6')
                    state['ps2_cutoff'] = True

        except Exception as e:
            ps2_dev = None
            with pzem_lock:
                pzem_cache['ps2'] = {
                    'sensor_connected': False,
                    'error': str(e),
                    'voltage': None, 'current': None, 'power': None,
                    'energy': None, 'frequency': None, 'pf': None, 'alarm': False,
                }

        time.sleep(2)


# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)   # allow Next.js dev server (different port) to call this


@app.route('/api/status', methods=['GET'])
def api_status():
    """Full system status — called by dashboard every 3s."""
    with pzem_lock:
        ps1 = pzem_cache['ps1'] or {
            'sensor_connected': False, 'error': 'Not yet read',
            'voltage': None, 'current': None, 'power': None,
            'energy': None, 'frequency': None, 'pf': None, 'alarm': False,
        }
        ps2 = pzem_cache['ps2'] or {
            'sensor_connected': False, 'error': 'Not yet read',
            'voltage': None, 'current': None, 'power': None,
            'energy': None, 'frequency': None, 'pf': None, 'alarm': False,
        }

    # Relay states (changeover)
    relays = {
        'ps1_l': GPIO.input(RELAY_MAP['R1']) == CHANGEOVER_ON,
        'ps1_n': GPIO.input(RELAY_MAP['R2']) == CHANGEOVER_ON,
        'ps2_l': GPIO.input(RELAY_MAP['R3']) == CHANGEOVER_ON,
        'ps2_n': GPIO.input(RELAY_MAP['R4']) == CHANGEOVER_ON,
    }

    return jsonify({
        'ps1': ps1,
        'ps2': ps2,
        'active_source': state['active_source'],
        'mode': state['mode'],
        'relays': relays,
        'cutoff': {
            'ps1': state['ps1_cutoff'],
            'ps2': state['ps2_cutoff'],
        },
        'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
    })


@app.route('/api/switch', methods=['POST'])
def api_switch():
    """Switch active power source. Body: { "source": 1 | 2 }"""
    body   = request.get_json(force=True)
    source = body.get('source')
    if source not in (1, 2):
        return jsonify({'error': 'source must be 1 or 2'}), 400

    switch_to_source(source)
    return jsonify({'ok': True, 'active_source': state['active_source']})


@app.route('/api/mode', methods=['POST'])
def api_mode():
    """Set switching mode. Body: { "mode": "auto" | "manual" }"""
    body = request.get_json(force=True)
    mode = body.get('mode')
    if mode not in ('auto', 'manual'):
        return jsonify({'error': 'mode must be auto or manual'}), 400

    state['mode'] = mode
    return jsonify({'ok': True, 'mode': mode})


@app.route('/api/cutoff', methods=['POST'])
def api_cutoff():
    """
    Cut or restore a power line.
    Body: { "source": 1 | 2, "cut": true | false }
    """
    body   = request.get_json(force=True)
    source = body.get('source')
    do_cut = body.get('cut')

    if source not in (1, 2) or not isinstance(do_cut, bool):
        return jsonify({'error': 'source (1|2) and cut (bool) required'}), 400

    relay = 'R5' if source == 1 else 'R6'
    key   = 'ps1_cutoff' if source == 1 else 'ps2_cutoff'

    if do_cut:
        cut_power(relay)
        state[key] = True
    else:
        restore_power(relay)
        state[key] = False

    return jsonify({'ok': True, 'source': source, 'cut': do_cut})


@app.route('/api/relay', methods=['POST'])
def api_relay():
    """
    Directly control a single changeover relay (R1-R4).
    Body: { "relay": "R1", "on": true | false }
    Use with caution — prefer /api/switch for source switching.
    """
    body  = request.get_json(force=True)
    relay = body.get('relay')
    on    = body.get('on')

    if relay not in ('R1', 'R2', 'R3', 'R4') or not isinstance(on, bool):
        return jsonify({'error': 'relay (R1-R4) and on (bool) required'}), 400

    set_changeover(relay, on)
    return jsonify({'ok': True, 'relay': relay, 'on': on})


@app.route('/api/ping', methods=['GET'])
def api_ping():
    return jsonify({'ok': True})


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    gpio_setup()

    # Start PZEM polling in background
    t = threading.Thread(target=poll_pzem, daemon=True)
    t.start()

    print("GridSentinel Flask server starting on 0.0.0.0:5000")
    print("Endpoints:")
    print("  GET  /api/status")
    print("  POST /api/switch   { source: 1|2 }")
    print("  POST /api/mode     { mode: auto|manual }")
    print("  POST /api/cutoff   { source: 1|2, cut: true|false }")
    print("  POST /api/relay    { relay: R1-R4, on: true|false }")
    print("  GET  /api/ping")

    app.run(host='0.0.0.0', port=5000, debug=False)
