"""
4-Relay Test Script
Cycles through all 4 relays individually, then together.

Wiring:
    R1 → GPIO 17   (PWR1 L-wire changeover)
    R2 → GPIO 27   (PWR1 N-wire changeover)
    R3 → GPIO 22   (PWR2 L-wire changeover)
    R4 → GPIO 23   (PWR2 N-wire changeover)
    R5 → GPIO 24   (PWR1 cutoff — overload protection)
    R6 → GPIO 25   (PWR2 cutoff — overload protection)

Required package:
    pip install RPi.GPIO        (usually pre-installed on Raspberry Pi OS)

NOTE: Most relay modules are ACTIVE LOW — GPIO LOW = relay ON.
      If your relays behave inverted, flip ACTIVE_LOW to False.
"""

import time
import RPi.GPIO as GPIO

# ── Config ────────────────────────────────────────────────────────────────────
RELAY_MAP = {
    'R1': 17,   # PWR1 L changeover
    'R2': 27,   # PWR1 N changeover
    'R3': 22,   # PWR2 L changeover
    'R4': 23,   # PWR2 N changeover
    'R5': 24,   # PWR1 cutoff (overload)
    'R6': 25,   # PWR2 cutoff (overload)
}

ACTIVE_LOW = True   # True for most opto-isolated relay boards
ON  = GPIO.LOW  if ACTIVE_LOW else GPIO.HIGH
OFF = GPIO.HIGH if ACTIVE_LOW else GPIO.LOW


# ── GPIO setup ────────────────────────────────────────────────────────────────
def setup():
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for name, pin in RELAY_MAP.items():
        GPIO.setup(pin, GPIO.OUT, initial=OFF)
        print(f"  [INIT] {name} → GPIO {pin}  (initial=OFF)")


def relay_on(name):
    GPIO.output(RELAY_MAP[name], ON)
    print(f"  >>> {name} (GPIO {RELAY_MAP[name]}) : ON  ●")


def relay_off(name):
    GPIO.output(RELAY_MAP[name], OFF)
    print(f"  --- {name} (GPIO {RELAY_MAP[name]}) : off ○")


def all_off():
    for name in RELAY_MAP:
        relay_off(name)


# ── Tests ─────────────────────────────────────────────────────────────────────
def test_individual(delay=1.5):
    """Turn each relay on then off, one at a time."""
    print("\n── Test 1: Individual relay cycle ──")
    for name in RELAY_MAP:
        print(f"\n  Testing {name}...")
        relay_on(name)
        time.sleep(delay)
        relay_off(name)
        time.sleep(0.5)


def test_ps1_pair(delay=2.0):
    """Activate PWR1 relay pair (R1+R2 together = PWR1 L+N)."""
    print("\n── Test 2: PWR1 pair  (R1 + R2) ──")
    relay_on('R1')
    relay_on('R2')
    print("  PWR1 path CLOSED (L + N)")
    time.sleep(delay)
    relay_off('R1')
    relay_off('R2')
    print("  PWR1 path OPEN")
    time.sleep(0.5)


def test_ps2_pair(delay=2.0):
    """Activate PWR2 relay pair (R3+R4 together = PWR2 L+N)."""
    print("\n── Test 3: PWR2 pair  (R3 + R4) ──")
    relay_on('R3')
    relay_on('R4')
    print("  PWR2 path CLOSED (L + N)")
    time.sleep(delay)
    relay_off('R3')
    relay_off('R4')
    print("  PWR2 path OPEN")
    time.sleep(0.5)


def test_switchover(delay=2.0):
    """
    Simulate a source switchover:
      Start on PS1  →  switch to PS2  →  switch back to PS1
    Safe order: open old path BEFORE closing new path.
    """
    print("\n── Test 4: Switchover  PS1 → PS2 → PS1 ──")

    print("\n  [1/5] PS1 active (R1+R2 ON)")
    relay_on('R1'); relay_on('R2')
    time.sleep(delay)

    print("\n  [2/5] Opening PS1 (R1+R2 OFF) …")
    relay_off('R1'); relay_off('R2')
    time.sleep(0.3)   # brief dead-time

    print("\n  [3/5] Closing PS2 (R3+R4 ON)")
    relay_on('R3'); relay_on('R4')
    time.sleep(delay)

    print("\n  [4/5] Opening PS2 (R3+R4 OFF) …")
    relay_off('R3'); relay_off('R4')
    time.sleep(0.3)

    print("\n  [5/5] Closing PS1 again (R1+R2 ON)")
    relay_on('R1'); relay_on('R2')
    time.sleep(delay)

    relay_off('R1'); relay_off('R2')
    print("\n  Switchover test done.")


def test_all_on(delay=2.0):
    """Turn all 4 relays on together, then off."""
    print("\n── Test 5: All relays ON simultaneously ──")
    for name in RELAY_MAP:
        relay_on(name)
    time.sleep(delay)
    all_off()
    print("  All relays OFF")


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    print("=== 4-Relay GPIO Test ===")
    print(f"  Mode  : {'ACTIVE LOW (most relay boards)' if ACTIVE_LOW else 'ACTIVE HIGH'}")
    print(f"  Relays: {RELAY_MAP}\n")

    try:
        setup()
        time.sleep(0.5)

        test_individual()
        test_ps1_pair()
        test_ps2_pair()
        test_switchover()
        test_all_on()

        print("\n[PASS] All relay tests completed.")

    except KeyboardInterrupt:
        print("\n[STOP] Test interrupted.")
    except RuntimeError as e:
        print(f"\n[ERROR] GPIO error: {e}")
        print("  → Make sure you are running as root or with 'sudo'")
        print("  → Or add user to gpio group: sudo usermod -aG gpio $USER")
    finally:
        all_off()
        GPIO.cleanup()
        print("[CLEANUP] GPIO released.")


if __name__ == '__main__':
    main()
