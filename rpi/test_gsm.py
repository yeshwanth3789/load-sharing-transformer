#!/usr/bin/env python3
"""
test_gsm.py — GSM module debug script for GridSentinel
Run on the Raspberry Pi:  python3 rpi/test_gsm.py
"""

import serial
import time

PORT   = '/dev/ttyS0'
BAUD   = 9600
NUMBER = '9553886260'

def send_cmd(gsm, cmd, wait=1.0):
    gsm.reset_input_buffer()
    gsm.write((cmd + '\r').encode())
    time.sleep(wait)
    resp = gsm.read(gsm.in_waiting).decode(errors='replace').strip()
    print(f'  >> {cmd}')
    print(f'  << {repr(resp)}')
    return resp

print()
print('=== GridSentinel GSM Test ===')
print(f'Port: {PORT}  Baud: {BAUD}')
print()

# ── Step 1: Open port ─────────────────────────────────────────────────────────
try:
    gsm = serial.Serial(PORT, BAUD, timeout=3)
    print('[1] Port opened OK')
except Exception as e:
    print(f'[1] FAILED to open port: {e}')
    print()
    print('Fix: run  sudo raspi-config  → Interface Options → Serial Port')
    print('     Disable login shell over serial: YES')
    print('     Enable serial hardware:          YES')
    exit(1)

time.sleep(0.5)

# ── Step 2: Basic AT ──────────────────────────────────────────────────────────
print()
print('[2] Testing AT response...')
resp = send_cmd(gsm, 'AT')
if 'OK' in resp:
    print('    PASS — module responding')
else:
    print('    FAIL — no OK response')
    print()
    print('Possible causes:')
    print('  1. TX/RX crossed — try swapping Pin 8 and Pin 10 wires')
    print('  2. Module not powered — check VCC (needs 3.7-4.2V, NOT 3.3V)')
    print('  3. Wrong baud rate — try 115200 by changing BAUD above')
    gsm.close()
    exit(1)

# ── Step 3: SIM card present ─────────────────────────────────────────────────
print()
print('[3] Checking SIM card...')
resp = send_cmd(gsm, 'AT+CIMI')   # IMSI — fails if no SIM
if 'ERROR' in resp or resp == '':
    print('    FAIL — SIM not detected or not ready')
    print('    Check SIM is inserted correctly and not PIN-locked')
else:
    print('    PASS — SIM detected')

# ── Step 4: Network registration ─────────────────────────────────────────────
print()
print('[4] Checking network registration...')
resp = send_cmd(gsm, 'AT+CREG?', wait=2)
if '+CREG: 0,1' in resp or '+CREG: 1,1' in resp:
    print('    PASS — registered on home network')
elif '+CREG: 0,5' in resp or '+CREG: 1,5' in resp:
    print('    PASS — registered on roaming network')
else:
    print('    FAIL — not registered on any network')
    print('    Check: SIM has balance, antenna is connected, signal strength below')

# ── Step 5: Signal strength ───────────────────────────────────────────────────
print()
print('[5] Signal strength...')
resp = send_cmd(gsm, 'AT+CSQ')
if '+CSQ:' in resp:
    try:
        rssi = int(resp.split('+CSQ:')[1].split(',')[0].strip())
        if rssi == 99:
            print('    FAIL — no signal (99 = unknown)')
        elif rssi < 10:
            print(f'    WEAK signal ({rssi}) — try moving module closer to window')
        else:
            print(f'    PASS — signal RSSI={rssi} (good if >10)')
    except Exception:
        print(f'    Raw: {resp}')

# ── Step 6: Send test SMS ─────────────────────────────────────────────────────
print()
print(f'[6] Sending test SMS to {NUMBER}...')
send_cmd(gsm, 'AT+CMGF=1')                        # text mode
send_cmd(gsm, f'AT+CMGS="{NUMBER}"', wait=1.5)
gsm.write(b'GridSentinel TEST SMS\x1a')            # message + Ctrl-Z
time.sleep(5)
resp = gsm.read(gsm.in_waiting).decode(errors='replace').strip()
print(f'  << {repr(resp)}')
if '+CMGS:' in resp:
    print('    PASS — SMS sent successfully!')
elif 'ERROR' in resp:
    print('    FAIL — SMS rejected. Check balance / network registration above.')
else:
    print('    UNKNOWN — wait a few seconds and check your phone')

gsm.close()
print()
print('=== Done ===')
print()
