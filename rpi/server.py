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
    PS2 → /dev/ttyS0     slave addr 0x01  (hardware UART GPIO14/15 — PZEM-004T connected)
"""

import time
import threading
import minimalmodbus
import RPi.GPIO as GPIO
from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    import smbus2 as _smbus2
    _HAS_SMBUS = True
except ImportError:
    _HAS_SMBUS = False

# ── Minimal HD44780 LCD driver (PCF8574 I2C backpack) ─────────────────────────
_PIN_RS = 0x01
_PIN_EN = 0x04
_PIN_BL = 0x08
_LCD_CMD = 0x00
_LCD_CHR = _PIN_RS
_ROW_OFFSETS = [0x00, 0x40, 0x14, 0x54]


class _I2CLCD:
    def __init__(self, bus=1, address=0x27, cols=16, rows=2):
        self.bus  = _smbus2.SMBus(bus)
        self.addr = address
        self.cols = cols
        self.rows = rows
        self.bl   = _PIN_BL
        self._init()

    def _w(self, d):
        self.bus.write_byte(self.addr, d | self.bl)

    def _en(self, d):
        time.sleep(0.0005)           # data-setup time before EN rises
        self._w(d | _PIN_EN)
        time.sleep(0.0005)           # EN pulse-width hold
        self._w(d & ~_PIN_EN)
        time.sleep(0.0001)           # EN fall hold

    def _nibble(self, n, m):
        self._w((n & 0xF0) | m)
        self._en((n & 0xF0) | m)

    def _byte(self, b, m):
        self._nibble(b & 0xF0, m)
        self._nibble((b << 4) & 0xF0, m)

    def _init(self):
        time.sleep(0.1)                                         # >40 ms after power-on
        self._nibble(0x30, _LCD_CMD); time.sleep(0.0045)       # >4.1 ms
        self._nibble(0x30, _LCD_CMD); time.sleep(0.0045)       # >4.1 ms
        self._nibble(0x30, _LCD_CMD); time.sleep(0.0001)       # >100 µs
        self._nibble(0x20, _LCD_CMD); time.sleep(0.001)        # switch to 4-bit
        for cmd in (0x28, 0x08, 0x01):
            self._byte(cmd, _LCD_CMD); time.sleep(0.003)       # 0x01 needs >1.52 ms
        self._byte(0x06, _LCD_CMD); time.sleep(0.001)          # entry mode
        self._byte(0x0C, _LCD_CMD); time.sleep(0.001)          # display on

    def set_cursor(self, col, row):
        self._byte(0x80 | (_ROW_OFFSETS[row] + col), _LCD_CMD)
        time.sleep(0.002)

    def print_line(self, text, row, align='left'):
        text = text[:self.cols]
        if align == 'center':
            text = text.center(self.cols)
        else:
            text = text.ljust(self.cols)
        self.set_cursor(0, row)
        for ch in text:
            self._byte(ord(ch), _LCD_CHR)

    def clear(self):
        self._byte(0x01, _LCD_CMD); time.sleep(0.002)

    def close(self):
        self.clear()
        self.bl = 0
        self._w(0)
        self.bus.close()


def _init_lcd():
    """Scan I2C bus 1 and return an _I2CLCD instance, or None if not found."""
    if not _HAS_SMBUS:
        print('[LCD] smbus2 not installed — display disabled')
        return None
    b = _smbus2.SMBus(1)
    found = []
    for addr in range(0x03, 0x78):
        try:
            b.read_byte(addr)
            found.append(addr)
        except OSError:
            pass
    b.close()
    for candidate in (0x27, 0x3F):
        if candidate in found:
            try:
                lcd = _I2CLCD(address=candidate)
                print(f'[LCD] Initialised at 0x{candidate:02X}')
                return lcd
            except Exception as e:
                print(f'[LCD] Init failed at 0x{candidate:02X}: {e}')
    if found:
        try:
            lcd = _I2CLCD(address=found[0])
            print(f'[LCD] Initialised at 0x{found[0]:02X} (auto)')
            return lcd
        except Exception as e:
            print(f'[LCD] Init failed: {e}')
    print('[LCD] No I2C LCD found — display disabled')
    return None


# ── Config ────────────────────────────────────────────────────────────────────
PS1_PORT      = '/dev/ttyUSB0'
PS2_PORT      = '/dev/ttyS0'    # hardware UART — GPIO 14 (TX) and 15 (RX)
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
    'dtr_cutoff': False,     # True = DTR emergency cutoff active (both cut)
    'ps1_threshold': 2500,   # configurable from dashboard
    'ps2_threshold': 2500,
}

pzem_cache = {
    'ps1': None,   # latest reading dict or None
    'ps2': None,
}

pzem_lock = threading.Lock()

_lcd      = None            # set in __main__ after gpio_setup
_lcd_lock = threading.Lock()


def _lcd_write(line0: str, line1: str):
    """Thread-safe helper — write two lines to the LCD if present."""
    with _lcd_lock:
        if _lcd is None:
            return
        try:
            _lcd.print_line(line0, 0)
            _lcd.print_line(line1, 1)
        except Exception as e:
            print(f'[LCD] Write error: {e}')


def lcd_loop():
    """Background thread — refreshes LCD every 2 s based on system state."""
    last = ('', '')
    while True:
        try:
            ps1_cut = state['ps1_cutoff']
            ps2_cut = state['ps2_cutoff']
            dtr     = state['dtr_cutoff']

            if dtr or (ps1_cut and ps2_cut):
                line0 = '!! DEPLOY  DTR !!'
                line1 = 'All power  cut!!'
            elif ps1_cut:
                line0 = 'Transformer 1'
                line1 = 'Failed-No Output'
            elif ps2_cut:
                line0 = 'Transformer 2'
                line1 = 'Failed-No Output'
            else:
                with pzem_lock:
                    p1 = pzem_cache['ps1']
                    p2 = pzem_cache['ps2']
                v1 = f"{p1['voltage']:.0f}V" if p1 and p1.get('voltage') else '---V'
                w1 = f"{p1['power']:.0f}W"   if p1 and p1.get('power')   else '---W'
                v2 = f"{p2['voltage']:.0f}V" if p2 and p2.get('voltage') else '---V'
                w2 = f"{p2['power']:.0f}W"   if p2 and p2.get('power')   else '---W'
                line0 = f'PS1 {v1} {w1}'
                line1 = f'PS2 {v2} {w2}'

            if (line0, line1) != last:
                _lcd_write(line0, line1)
                last = (line0, line1)

        except Exception as e:
            print(f'[LCD] Loop error: {e}')

        time.sleep(2)


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

        # ── DTR detection: combined load exceeds total capacity ──────────
        if state['mode'] == 'auto' and not state['dtr_cutoff']:
            ps1_data = pzem_cache.get('ps1')
            ps2_data = pzem_cache.get('ps2')
            p1 = (ps1_data or {}).get('power') or 0
            p2 = (ps2_data or {}).get('power') or 0
            total_load = p1 + p2
            total_capacity = state['ps1_threshold'] + state['ps2_threshold']

            if total_load > total_capacity:
                print(f"[DTR] EMERGENCY! Combined {total_load:.0f}W > capacity {total_capacity}W — cutting BOTH")
                # Turn off all changeover relays first (stops sockets and bulbs on both sides)
                for r in ['R1', 'R2', 'R3', 'R4']:
                    set_changeover(r, False)
                cut_power('R5')
                state['ps1_cutoff'] = True
                cut_power('R6')
                state['ps2_cutoff'] = True
                state['dtr_cutoff'] = True

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

    # Relay states — changeover R1-R4 + cutoff R5-R6
    relays = {
        'ps1_l':   GPIO.input(RELAY_MAP['R1']) == CHANGEOVER_ON,
        'ps1_n':   GPIO.input(RELAY_MAP['R2']) == CHANGEOVER_ON,
        'ps2_l':   GPIO.input(RELAY_MAP['R3']) == CHANGEOVER_ON,
        'ps2_n':   GPIO.input(RELAY_MAP['R4']) == CHANGEOVER_ON,
        'ps1_cut': state['ps1_cutoff'],   # R5 — PWR1 cutoff
        'ps2_cut': state['ps2_cutoff'],   # R6 — PWR2 cutoff
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
        'dtr_cutoff': state['dtr_cutoff'],
        'thresholds': {
            'ps1': state['ps1_threshold'],
            'ps2': state['ps2_threshold'],
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
        # Clear DTR cutoff lock when user restores any source
        if state['dtr_cutoff']:
            state['dtr_cutoff'] = False
            print("[DTR] Emergency cutoff released by manual restore.")

    return jsonify({'ok': True, 'source': source, 'cut': do_cut})


@app.route('/api/relay', methods=['POST'])
def api_relay():
    """
    Directly control any relay R1-R6.
    Body: { "relay": "R1", "on": true | false }
    R1-R4 = changeover (prefer /api/switch instead)
    R5-R6 = cutoff     (prefer /api/cutoff instead)
    """
    body  = request.get_json(force=True)
    relay = body.get('relay')
    on    = body.get('on')

    if relay not in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6') or not isinstance(on, bool):
        return jsonify({'error': 'relay (R1-R6) and on (bool) required'}), 400

    if relay in ('R1', 'R2', 'R3', 'R4'):
        set_changeover(relay, on)
    else:
        # R5 / R6 cutoff relays
        key = 'ps1_cutoff' if relay == 'R5' else 'ps2_cutoff'
        if on:
            cut_power(relay)
            state[key] = True
        else:
            restore_power(relay)
            state[key] = False

    return jsonify({'ok': True, 'relay': relay, 'on': on})


@app.route('/api/thresholds', methods=['POST'])
def api_thresholds():
    """
    Set load sharing thresholds (synced from dashboard).
    Body: { "ps1": 2500, "ps2": 2500 }
    """
    body = request.get_json(force=True)
    ps1_t = body.get('ps1')
    ps2_t = body.get('ps2')

    if ps1_t is not None and isinstance(ps1_t, (int, float)) and ps1_t > 0:
        state['ps1_threshold'] = int(ps1_t)
    if ps2_t is not None and isinstance(ps2_t, (int, float)) and ps2_t > 0:
        state['ps2_threshold'] = int(ps2_t)

    print(f"[THRESHOLDS] Updated: PS1={state['ps1_threshold']}W  PS2={state['ps2_threshold']}W")
    return jsonify({
        'ok': True,
        'ps1': state['ps1_threshold'],
        'ps2': state['ps2_threshold'],
    })


@app.route('/api/ping', methods=['GET'])
def api_ping():
    return jsonify({'ok': True})


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    gpio_setup()

    # Init LCD (optional — server works fine without it)
    _lcd = _init_lcd()
    if _lcd:
        _lcd_write('GridSentinel', 'Starting...')
        time.sleep(1)

    # Start PZEM polling in background
    t = threading.Thread(target=poll_pzem, daemon=True)
    t.start()

    # Start LCD refresh loop in background
    t2 = threading.Thread(target=lcd_loop, daemon=True)
    t2.start()

    print("GridSentinel Flask server starting on 0.0.0.0:5000")
    print("Endpoints:")
    print("  GET  /api/status")
    print("  POST /api/switch      { source: 1|2 }")
    print("  POST /api/mode        { mode: auto|manual }")
    print("  POST /api/cutoff      { source: 1|2, cut: true|false }")
    print("  POST /api/thresholds  { ps1: 2500, ps2: 2500 }")
    print("  POST /api/relay       { relay: R1-R6, on: true|false }")
    print("  GET  /api/ping")

    app.run(host='0.0.0.0', port=5000, debug=False)
