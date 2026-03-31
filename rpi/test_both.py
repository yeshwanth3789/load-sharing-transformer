"""
Combined Test — PZEM + Relays
Switches PS1 on, reads PZEM, switches PS2 on, reads PZEM, shows diff.

Run this LAST after individual tests pass.
"""

import time
import minimalmodbus
import RPi.GPIO as GPIO

# ── PZEM config ───────────────────────────────────────────────────────────────
PORT       = '/dev/ttyUSB0'
SLAVE_ADDR = 0x01
BAUD       = 9600

# ── Relay config ──────────────────────────────────────────────────────────────
RELAY_MAP  = {'R1': 17, 'R2': 27, 'R3': 22, 'R4': 23}
ACTIVE_LOW = True
ON  = GPIO.LOW  if ACTIVE_LOW else GPIO.HIGH
OFF = GPIO.HIGH if ACTIVE_LOW else GPIO.LOW


def gpio_setup():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in RELAY_MAP.values():
        GPIO.setup(pin, GPIO.OUT, initial=OFF)


def set_source(source):
    """Switch load to source 1 or 2. Opens old path first."""
    if source == 1:
        GPIO.output(RELAY_MAP['R3'], OFF); GPIO.output(RELAY_MAP['R4'], OFF)
        time.sleep(0.2)
        GPIO.output(RELAY_MAP['R1'], ON);  GPIO.output(RELAY_MAP['R2'], ON)
    else:
        GPIO.output(RELAY_MAP['R1'], OFF); GPIO.output(RELAY_MAP['R2'], OFF)
        time.sleep(0.2)
        GPIO.output(RELAY_MAP['R3'], ON);  GPIO.output(RELAY_MAP['R4'], ON)
    print(f"  Source → PS{source}")


def pzem_connect():
    dev = minimalmodbus.Instrument(PORT, SLAVE_ADDR)
    dev.serial.baudrate = BAUD
    dev.serial.timeout  = 1.0
    dev.mode            = minimalmodbus.MODE_RTU
    return dev


def pzem_read(dev):
    regs     = dev.read_registers(0x0000, 10, functioncode=4)
    voltage  = regs[0] * 0.1
    current  = ((regs[2] << 16) | regs[1]) * 0.001
    power    = ((regs[4] << 16) | regs[3]) * 0.1
    freq     = regs[7] * 0.1
    pf       = regs[8] * 0.01
    return {'V': round(voltage,1), 'A': round(current,3),
            'W': round(power,1),   'Hz': round(freq,1), 'PF': round(pf,2)}


def print_row(label, d):
    print(f"  {label:6} │ {d['V']:6.1f} V │ {d['A']:6.3f} A │ {d['W']:7.1f} W │ {d['Hz']:5.1f} Hz │ PF {d['PF']:.2f}")


def main():
    print("=== Combined PZEM + Relay Test ===\n")
    gpio_setup()

    try:
        dev = pzem_connect()
        print(f"[OK] PZEM on {PORT}\n")
    except Exception as e:
        print(f"[ERROR] PZEM: {e}")
        GPIO.cleanup()
        return

    print(f"  {'':6} │ {'Voltage':8} │ {'Current':8} │ {'Power':9} │ {'Freq':7} │ PF")
    print(f"  {'─'*6}─┼─{'─'*8}─┼─{'─'*8}─┼─{'─'*9}─┼─{'─'*7}─┼─{'─'*6}")

    try:
        for src in [1, 2, 1]:
            set_source(src)
            time.sleep(1.5)   # settle time
            try:
                data = pzem_read(dev)
                print_row(f"PS{src}", data)
            except Exception as e:
                print(f"  PS{src}   │ PZEM read error: {e}")
            time.sleep(1)

        print("\n[DONE] Both sources tested with live readings.")

    except KeyboardInterrupt:
        print("\n[STOP]")
    finally:
        for pin in RELAY_MAP.values():
            GPIO.output(pin, OFF)
        GPIO.cleanup()
        dev.serial.close()


if __name__ == '__main__':
    main()
