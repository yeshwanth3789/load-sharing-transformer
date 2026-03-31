"""
Test R5 and R6 cutoff relays only.
    R5 → GPIO 24   (PWR1 cutoff)
    R6 → GPIO 25   (PWR2 cutoff)
"""

import time
import RPi.GPIO as GPIO

R5 = 24
R6 = 25

# These relays disconnect on LOW (active low)
# LOW  = relay energizes = NC opens = power cut
# HIGH = relay de-energizes = NC closed = power flows normally
CUT   = GPIO.LOW   # cut power
ALLOW = GPIO.HIGH  # allow power

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
# default HIGH = power flows on startup
GPIO.setup(R5, GPIO.OUT, initial=ALLOW)
GPIO.setup(R6, GPIO.OUT, initial=ALLOW)
print("  Init: R5 + R6 HIGH — power flowing normally\n")

try:
    print("Testing R5 (GPIO 24) — cutting PWR1 ...")
    GPIO.output(R5, CUT)
    print("  R5 LOW → PWR1 disconnected")
    time.sleep(2)
    GPIO.output(R5, ALLOW)
    print("  R5 HIGH → PWR1 restored")
    time.sleep(1)

    print("\nTesting R6 (GPIO 25) — cutting PWR2 ...")
    GPIO.output(R6, CUT)
    print("  R6 LOW → PWR2 disconnected")
    time.sleep(2)
    GPIO.output(R6, ALLOW)
    print("  R6 HIGH → PWR2 restored")
    time.sleep(1)

    print("\nBoth cut together ...")
    GPIO.output(R5, CUT)
    GPIO.output(R6, CUT)
    print("  R5 + R6 LOW → both disconnected")
    time.sleep(2)
    GPIO.output(R5, ALLOW)
    GPIO.output(R6, ALLOW)
    print("  R5 + R6 HIGH → both restored")

    print("\n[DONE] Cutoff relay test complete.")

except KeyboardInterrupt:
    print("\n[STOP]")
finally:
    GPIO.output(R5, ALLOW)
    GPIO.output(R6, ALLOW)
    GPIO.cleanup()
    print("[CLEANUP] GPIO released — power restored.")
