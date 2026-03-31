"""
PZEM-004T v3.0 — Test Script
Reads all sensor values over Modbus RTU via /dev/ttyUSB0

Required package:
    pip install minimalmodbus

PZEM default Modbus address : 0x01
Baud rate                   : 9600
"""

import time
import minimalmodbus

# ── Config ────────────────────────────────────────────────────────────────────
PORT         = '/dev/ttyUSB0'
SLAVE_ADDR   = 0x01          # default factory address
BAUD         = 9600
TIMEOUT      = 1.0           # seconds

# PZEM-004T input register addresses (read with function code 4)
REG_VOLTAGE  = 0x0000        # ×0.1  V
REG_CURR_L   = 0x0001        # ×0.001 A  (low word)
REG_CURR_H   = 0x0002        # ×0.001 A  (high word — combine with low)
REG_PWR_L    = 0x0003        # ×0.1  W   (low word)
REG_PWR_H    = 0x0004        # ×0.1  W   (high word)
REG_ENERGY_L = 0x0005        # ×1    Wh  (low word)
REG_ENERGY_H = 0x0006        # ×1    Wh  (high word)
REG_FREQ     = 0x0007        # ×0.1  Hz
REG_PF       = 0x0008        # ×0.01
REG_ALARM    = 0x0009        # 0xFF = alarm triggered


def connect():
    """Open Modbus connection to PZEM."""
    device = minimalmodbus.Instrument(PORT, SLAVE_ADDR)
    device.serial.baudrate = BAUD
    device.serial.timeout  = TIMEOUT
    device.mode            = minimalmodbus.MODE_RTU
    device.debug           = False
    print(f"[OK] Opened {PORT}  slave={SLAVE_ADDR}  baud={BAUD}")
    return device


def read_all(dev):
    """Read all 10 input registers in one shot and return a dict."""
    # Read 10 registers starting at 0x0000 (function code 4)
    regs = dev.read_registers(0x0000, 10, functioncode=4)

    voltage  = regs[0] * 0.1
    current  = ((regs[2] << 16) | regs[1]) * 0.001
    power    = ((regs[4] << 16) | regs[3]) * 0.1
    energy   = ((regs[6] << 16) | regs[5])          # Wh
    freq     = regs[7] * 0.1
    pf       = regs[8] * 0.01
    alarm    = regs[9]

    return {
        'voltage_V':  round(voltage,  1),
        'current_A':  round(current,  3),
        'power_W':    round(power,    1),
        'energy_Wh':  energy,
        'freq_Hz':    round(freq,     1),
        'pf':         round(pf,       2),
        'alarm':      bool(alarm),
    }


def print_reading(data):
    print("─" * 38)
    print(f"  Voltage   : {data['voltage_V']:>8.1f}  V")
    print(f"  Current   : {data['current_A']:>8.3f}  A")
    print(f"  Power     : {data['power_W']:>8.1f}  W")
    print(f"  Energy    : {data['energy_Wh']:>8d}  Wh")
    print(f"  Frequency : {data['freq_Hz']:>8.1f}  Hz")
    print(f"  Pow. factor:{data['pf']:>8.2f}")
    print(f"  Alarm     : {'YES ⚠' if data['alarm'] else 'No'}")
    print("─" * 38)


def main():
    print("=== PZEM-004T Test  (Ctrl+C to stop) ===\n")

    try:
        dev = connect()
    except Exception as e:
        print(f"[ERROR] Cannot open {PORT}: {e}")
        print("\nTips:")
        print("  • Check USB cable is plugged into RPi")
        print("  • ls /dev/ttyUSB*  — confirm device path")
        print("  • sudo usermod -aG dialout $USER  — then re-login")
        return

    loop = 0
    try:
        while True:
            loop += 1
            print(f"\nReading #{loop}  [{time.strftime('%H:%M:%S')}]")
            try:
                data = read_all(dev)
                print_reading(data)
            except minimalmodbus.NoResponseError:
                print("[WARN] No response — check wiring and Modbus address")
            except minimalmodbus.InvalidResponseError as e:
                print(f"[WARN] Bad response: {e}")
            time.sleep(2)

    except KeyboardInterrupt:
        print("\n[STOP] Test ended.")
    finally:
        dev.serial.close()


if __name__ == '__main__':
    main()
