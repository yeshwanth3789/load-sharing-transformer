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
import json
import os
import minimalmodbus
import RPi.GPIO as GPIO
from flask import Flask, jsonify, request
from flask_cors import CORS

STATE_FILE        = '/tmp/gridsentinel_state.json'
AUTO_RESTORE_SECS = 15   # seconds before a manually-cut relay is auto-restored

# ── Auto-restore timers ───────────────────────────────────────────────────────
_restore_timers      = {'R5': None, 'R6': None}
_restore_timer_lock  = threading.Lock()


def _auto_restore(relay: str):
    """
    Fired by threading.Timer after AUTO_RESTORE_SECS.
    Restores the cutoff relay AND resets the matching changeover relays to NC
    so that power flows straight through to the load (bulb + holder turn on).
    """
    key = 'ps1_cutoff' if relay == 'R5' else 'ps2_cutoff'

    # Step 1: restore power line
    restore_power(relay)
    state[key] = False

    # Step 2: put changeover relays back to NC (home source path)
    # R5 → PWR1 line → NC of R1/R2 feeds PS1 load (bulb + holder)
    # R6 → PWR2 line → NC of R3/R4 feeds PS2 load
    if relay == 'R5':
        set_changeover('R1', False)   # NC: PWR1-L → PS1 load L
        set_changeover('R2', False)   # NC: PWR1-N → PS1 load N
        state['active_source'] = 1
    else:
        set_changeover('R3', False)   # NC: PWR2-L → PS2 load L
        set_changeover('R4', False)   # NC: PWR2-N → PS2 load N

    # Step 3: clear DTR lock if both lines are now live
    if not state['ps1_cutoff'] and not state['ps2_cutoff']:
        state['dtr_cutoff'] = False

    _save_cutoff_state()
    print(f'[AUTO-RESTORE] {relay} restored after {AUTO_RESTORE_SECS} s — changeover relays reset to NC, load powered')
    with _restore_timer_lock:
        _restore_timers[relay] = None


def _schedule_restore(relay: str):
    """Start (or restart) the AUTO_RESTORE_SECS countdown for relay R5 or R6."""
    with _restore_timer_lock:
        existing = _restore_timers.get(relay)
        if existing:
            existing.cancel()
        t = threading.Timer(AUTO_RESTORE_SECS, _auto_restore, args=[relay])
        t.daemon = True
        t.start()
        _restore_timers[relay] = t


def _cancel_restore(relay: str):
    """Cancel a pending auto-restore (used when user manually restores first)."""
    with _restore_timer_lock:
        t = _restore_timers.get(relay)
        if t:
            t.cancel()
            _restore_timers[relay] = None


def _save_cutoff_state():
    """Persist cutoff flags so they survive server restarts."""
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump({
                'ps1_cutoff': state['ps1_cutoff'],
                'ps2_cutoff': state['ps2_cutoff'],
                'dtr_cutoff': state['dtr_cutoff'],
            }, f)
    except Exception as e:
        print(f'[STATE] Save failed: {e}')


def _load_cutoff_state():
    """Load and reapply GPIO cutoff state from last run."""
    if not os.path.exists(STATE_FILE):
        return
    try:
        with open(STATE_FILE) as f:
            saved = json.load(f)
        if saved.get('ps1_cutoff'):
            cut_power('R5')
            state['ps1_cutoff'] = True
            _schedule_restore('R5')
            print('[STATE] Restored: PS1 cutoff (R5) active — auto-restore in 15 s')
        if saved.get('ps2_cutoff'):
            cut_power('R6')
            state['ps2_cutoff'] = True
            _schedule_restore('R6')
            print('[STATE] Restored: PS2 cutoff (R6) active — auto-restore in 15 s')
        if saved.get('dtr_cutoff'):
            state['dtr_cutoff'] = True
    except Exception as e:
        print(f'[STATE] Load failed: {e}')

try:
    import smbus2 as _smbus2
    _HAS_SMBUS = True
except ImportError:
    _HAS_SMBUS = False

try:
    import serial as _serial
    _HAS_SERIAL = True
except ImportError:
    _HAS_SERIAL = False

# ── GSM / SMS config ──────────────────────────────────────────────────────────
GSM_PORT         = '/dev/ttyS0'     # shared with PS2 PZEM — protected by _ttyS0_lock
GSM_BAUD         = 9600
ALERT_NUMBER     = '9553886260'
SMS_COOLDOWN     = 60               # seconds between identical SMS types

_ttyS0_lock      = threading.Lock()  # shared between PS2 PZEM reads and GSM SMS sends
_sms_last_sent   = {}               # key → epoch timestamp of last send


def send_sms(key: str, message: str):
    """
    Send an SMS via the GSM module using AT commands.
    key is used to enforce SMS_COOLDOWN — same key won't fire again within the window.
    Runs in a daemon thread so it never blocks the Flask or poll loops.
    """
    if not _HAS_SERIAL:
        print(f'[GSM] pyserial not installed — SMS skipped ({key})')
        return
    now = time.time()
    if now - _sms_last_sent.get(key, 0) < SMS_COOLDOWN:
        return
    _sms_last_sent[key] = now

    def _worker():
        with _ttyS0_lock:   # wait for PS2 PZEM to finish its current read
            try:
                gsm = _serial.Serial(GSM_PORT, GSM_BAUD, timeout=5)
                time.sleep(0.3)
                gsm.reset_input_buffer()
                gsm.write(b'AT\r');            time.sleep(0.5)
                gsm.reset_input_buffer()
                gsm.write(b'AT+CMGF=1\r');    time.sleep(0.5)   # text mode
                gsm.reset_input_buffer()
                gsm.write(f'AT+CMGS="{ALERT_NUMBER}"\r'.encode()); time.sleep(0.5)
                gsm.write(message.encode('ascii', errors='replace') + b'\x1a')  # Ctrl-Z sends
                time.sleep(3)
                gsm.close()
                print(f'[GSM] SMS sent ({key}): {message}')
            except Exception as e:
                print(f'[GSM] SMS failed ({key}): {e}')

    threading.Thread(target=_worker, daemon=True).start()

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
        time.sleep(0.3)                                         # JHD 162A needs >200 ms
        for delay in (0.005, 0.005, 0.002, 0.002):
            self._nibble(0x30, _LCD_CMD); time.sleep(delay)    # 4× 8-bit reset
        self._nibble(0x20, _LCD_CMD); time.sleep(0.01)         # switch to 4-bit
        for cmd, wait in ((0x28, 0.005), (0x08, 0.005), (0x01, 0.005),
                          (0x06, 0.005), (0x0C, 0.005)):
            self._byte(cmd, _LCD_CMD); time.sleep(wait)

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


def _lcd_scroll_alert(header: str, message: str, while_fn=None, step: float = 0.28):
    """
    Show header on row 0 and scroll message on row 1.
    Keeps scrolling while while_fn() returns True.
    Defaults to scrolling while any cutoff flag is set.
    step = seconds per character shift.
    """
    if while_fn is None:
        def while_fn():
            return state['ps1_cutoff'] or state['ps2_cutoff'] or state['dtr_cutoff']

    with _lcd_lock:
        if _lcd is None:
            time.sleep(step)
            return
        cols = _lcd.cols

    padded  = ' ' * cols + message + ' ' * cols
    pad_len = len(padded)
    i = 0

    while while_fn():
        frame = (padded + padded)[i: i + cols]
        with _lcd_lock:
            if _lcd:
                try:
                    _lcd.print_line(header, 0, align='center')
                    _lcd.print_line(frame,  1)
                except Exception as e:
                    print(f'[LCD] Scroll error: {e}')
        i = (i + 1) % pad_len
        time.sleep(step)


def lcd_loop():
    """Background thread — scrolls alerts on cutoff, shows live readings otherwise."""
    while True:
        try:
            ps1_cut = state['ps1_cutoff']
            ps2_cut = state['ps2_cutoff']
            dtr     = state['dtr_cutoff']

            if dtr or (ps1_cut and ps2_cut):
                _lcd_scroll_alert(
                    '  !! ALERT !!',
                    'Transformer 1 & 2 have failed - No output for all sources!'
                )

            elif ps1_cut and state['active_source'] == 2:
                # PS1 was cut due to overload — PS2 is now supplying the load (load sharing)
                with pzem_lock:
                    p2d = pzem_cache['ps2']
                pw2  = (p2d or {}).get('power') or 0
                t1   = state['ps1_threshold']
                over = max(0, pw2 - 1)   # PS2 effective overflow contribution
                def _sharing_active():
                    return state['ps1_cutoff'] and state['active_source'] == 2
                _lcd_scroll_alert(
                    ' LOAD SHARING ',
                    f'PS1 cut - Load sharing from PS2  PS2:{pw2:.0f}W active  ',
                    while_fn=_sharing_active,
                )

            elif ps1_cut:
                _lcd_scroll_alert(
                    '  !! ALERT !!',
                    'Transformer 1 has failed - No output for all sources!'
                )

            elif ps2_cut:
                _lcd_scroll_alert(
                    '  !! ALERT !!',
                    'Transformer 2 has failed - No output for all sources!'
                )

            else:
                with pzem_lock:
                    p1d = pzem_cache['ps1']
                    p2d = pzem_cache['ps2']
                pw1 = (p1d or {}).get('power') or 0
                pw2 = (p2d or {}).get('power') or 0
                t1  = state['ps1_threshold']
                t2  = state['ps2_threshold']

                if pw1 > t1 and not state['ps1_cutoff']:
                    over = pw1 - t1
                    def _ps1_over():
                        return ((pzem_cache.get('ps1') or {}).get('power') or 0) > state['ps1_threshold'] \
                               and not state['ps1_cutoff']
                    _lcd_scroll_alert(
                        ' LOAD SHARING ',
                        f'PS1:{pw1:.0f}W>{t1:.0f}W - Sharing {over:.0f}W from PS2  ',
                        while_fn=_ps1_over,
                    )

                elif pw2 > t2 and not state['ps2_cutoff']:
                    over = pw2 - t2
                    def _ps2_over():
                        return ((pzem_cache.get('ps2') or {}).get('power') or 0) > state['ps2_threshold'] \
                               and not state['ps2_cutoff']
                    _lcd_scroll_alert(
                        ' LOAD SHARING ',
                        f'PS2:{pw2:.0f}W>{t2:.0f}W - Sharing {over:.0f}W from PS1  ',
                        while_fn=_ps2_over,
                    )

                else:
                    v1 = f"{p1d['voltage']:.0f}V" if p1d and p1d.get('voltage') else '---V'
                    w1 = f"{pw1:.0f}W"             if p1d else '---W'
                    v2 = f"{p2d['voltage']:.0f}V" if p2d and p2d.get('voltage') else '---V'
                    w2 = f"{pw2:.0f}W"             if p2d else '---W'
                    _lcd_write(f'PS1 {v1} {w1}', f'PS2 {v2} {w2}')
                    time.sleep(2)

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

            # Load sharing SMS — fire when PS1 exceeds user threshold (before hard cut)
            ps1_power = data['power']
            ps1_thresh = state['ps1_threshold']
            if ps1_power > ps1_thresh and not state['ps1_cutoff']:
                over = ps1_power - ps1_thresh
                send_sms(
                    'load_sharing_ps1',
                    f'LOAD SHARING ACTIVE: PS1 load {ps1_power:.0f}W exceeds {ps1_thresh:.0f}W threshold. '
                    f'Sharing {over:.0f}W from PS2. - GridSentinel'
                )

            # Auto overload cutoff
            if state['mode'] == 'auto' and data['power'] > OVERLOAD_WATTS:
                if state['active_source'] == 1 and not state['ps1_cutoff']:
                    cut_power('R5')
                    state['ps1_cutoff'] = True
                    _save_cutoff_state()
                    send_sms(
                        'ps1_cut',
                        f'ALERT: Transformer 1 (PS1) auto-cut! Load {data["power"]:.0f}W exceeded hard limit. '
                        f'No output voltage. - GridSentinel'
                    )

        except Exception as e:
            ps1_dev = None
            with pzem_lock:
                pzem_cache['ps1'] = {
                    'sensor_connected': False,
                    'error': str(e),
                    'voltage': None, 'current': None, 'power': None,
                    'energy': None, 'frequency': None, 'pf': None, 'alarm': False,
                }

        # PS2 — open/read/close each cycle so _ttyS0_lock can be released for GSM SMS
        try:
            with _ttyS0_lock:
                _dev = open_pzem(PS2_PORT)
                data = read_pzem(_dev)
                _dev.serial.close()
            ps2_dev = None   # always None — port is not kept open
            with pzem_lock:
                pzem_cache['ps2'] = {**data, 'sensor_connected': True, 'error': None}

            # Load sharing SMS for PS2 exceeding threshold
            ps2_power = data['power']
            ps2_thresh = state['ps2_threshold']
            if ps2_power > ps2_thresh and not state['ps2_cutoff']:
                over2 = ps2_power - ps2_thresh
                send_sms(
                    'load_sharing_ps2',
                    f'LOAD SHARING ACTIVE: PS2 load {ps2_power:.0f}W exceeds {ps2_thresh:.0f}W threshold. '
                    f'Sharing {over2:.0f}W from PS1. - GridSentinel'
                )

            if state['mode'] == 'auto' and data['power'] > OVERLOAD_WATTS:
                if state['active_source'] == 2 and not state['ps2_cutoff']:
                    cut_power('R6')
                    state['ps2_cutoff'] = True
                    _save_cutoff_state()
                    send_sms(
                        'ps2_cut',
                        f'ALERT: Transformer 2 (PS2) auto-cut! Load {data["power"]:.0f}W exceeded hard limit. '
                        f'No output voltage. - GridSentinel'
                    )

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
                deficit = total_load - total_capacity
                send_sms(
                    'dtr',
                    f'*** EMERGENCY *** DEPLOY TRANSFORMER NOW! '
                    f'Combined load {total_load:.0f}W exceeds total capacity {total_capacity:.0f}W. '
                    f'Deficit: {deficit:.0f}W. Both PS1 and PS2 being cut. '
                    f'DEPLOY TEMPORARY TRANSFORMER IMMEDIATELY! - GridSentinel'
                )
                print(f"[DTR] EMERGENCY! Combined {total_load:.0f}W > capacity {total_capacity}W — cutting BOTH")
                # Turn off all changeover relays first (stops sockets and bulbs on both sides)
                for r in ['R1', 'R2', 'R3', 'R4']:
                    set_changeover(r, False)
                cut_power('R5')
                state['ps1_cutoff'] = True
                cut_power('R6')
                state['ps2_cutoff'] = True
                state['dtr_cutoff'] = True
                _save_cutoff_state()

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
        _schedule_restore(relay)           # auto-restore after 15 s
        send_sms(
            f'ps{source}_cut',
            f'ALERT: Transformer {source} (PS{source}) relay cut manually. '
            f'No output voltage or current on PS{source}. - GridSentinel'
        )
    else:
        _cancel_restore(relay)             # user restored manually — cancel timer
        restore_power(relay)
        state[key] = False
        # Clear DTR cutoff lock when user restores any source
        if state['dtr_cutoff']:
            state['dtr_cutoff'] = False
            print("[DTR] Emergency cutoff released by manual restore.")
    _save_cutoff_state()

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
            _schedule_restore(relay)       # auto-restore after 15 s
        else:
            _cancel_restore(relay)         # user restored manually — cancel timer
            restore_power(relay)
            state[key] = False
        _save_cutoff_state()

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
    _load_cutoff_state()   # reapply any cutoffs that were active before restart

    # Init LCD (optional — server works fine without it)
    global _lcd
    _lcd = _init_lcd()
    if _lcd:
        _lcd.clear()
        time.sleep(0.005)
        _lcd_write('GridSentinel', 'Starting...')
        time.sleep(0.3)   # brief splash — lcd_loop takes over immediately after

    # Start PZEM polling in background
    t = threading.Thread(target=poll_pzem, daemon=True)
    t.start()

    # Start LCD refresh loop in background
    t2 = threading.Thread(target=lcd_loop, daemon=True)
    t2.start()

    print("GridSentinel Flask server starting on 0.0.0.0:5000")
    if _HAS_SERIAL:
        print(f"[GSM] SMS alerts enabled → {ALERT_NUMBER} via {GSM_PORT}")
    else:
        print("[GSM] pyserial not found — run: pip3 install pyserial")
    print("Endpoints:")
    print("  GET  /api/status")
    print("  POST /api/switch      { source: 1|2 }")
    print("  POST /api/mode        { mode: auto|manual }")
    print("  POST /api/cutoff      { source: 1|2, cut: true|false }")
    print("  POST /api/thresholds  { ps1: 2500, ps2: 2500 }")
    print("  POST /api/relay       { relay: R1-R6, on: true|false }")
    print("  GET  /api/ping")

    app.run(host='0.0.0.0', port=5000, debug=False)
