"""
Test R5 and R6 cutoff relays only.
    R5 → GPIO 24   (PWR1 cutoff)
    R6 → GPIO 25   (PWR2 cutoff)

NOTE: RPi GPIO is 3.3V but relay board needs 5V for HIGH.
      So we cannot drive HIGH to release the relay.
      Instead:
        CUT   = set pin OUTPUT LOW  → relay energizes → NC opens → power cut
        ALLOW = set pin to INPUT    → board's 5V pull-up releases relay → power flows
"""

import time
import RPi.GPIO as GPIO

R5 = 24
R6 = 25

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)


def cut(pin):
    GPIO.setup(pin, GPIO.OUT)
    GPIO.output(pin, GPIO.LOW)


def allow(pin):
    GPIO.setup(pin, GPIO.IN)   # float → board pull-up releases relay


# Start with power flowing
allow(R5)
allow(R6)
print("  Init: R5 + R6 released — power flowing\n")

try:
    print("Testing R5 (GPIO 24) — cutting PWR1 ...")
    cut(R5)
    print("  R5 LOW → PWR1 disconnected")
    time.sleep(2)
    allow(R5)
    print("  R5 released → PWR1 restored")
    time.sleep(1)

    print("\nTesting R6 (GPIO 25) — cutting PWR2 ...")
    cut(R6)
    print("  R6 LOW → PWR2 disconnected")
    time.sleep(2)
    allow(R6)
    print("  R6 released → PWR2 restored")
    time.sleep(1)

    print("\nBoth cut together ...")
    cut(R5)
    cut(R6)
    print("  R5 + R6 LOW → both disconnected")
    time.sleep(2)
    allow(R5)
    allow(R6)
    print("  R5 + R6 released → both restored")

    print("\n[DONE] Cutoff relay test complete.")

except KeyboardInterrupt:
    print("\n[STOP]")
finally:
    allow(R5)
    allow(R6)
    GPIO.cleanup()
    print("[CLEANUP] GPIO released — power restored.")
