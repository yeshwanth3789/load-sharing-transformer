"""
Test R5 and R6 cutoff relays only.
    R5 → GPIO 24   (PWR1 cutoff)
    R6 → GPIO 25   (PWR2 cutoff)
"""

import time
import RPi.GPIO as GPIO

R5 = 24
R6 = 25

ACTIVE_LOW = True
ON  = GPIO.LOW  if ACTIVE_LOW else GPIO.HIGH
OFF = GPIO.HIGH if ACTIVE_LOW else GPIO.LOW

GPIO.setmode(GPIO.BCM)
GPIO.setwarnings(False)
GPIO.setup(R5, GPIO.OUT, initial=OFF)
GPIO.setup(R6, GPIO.OUT, initial=OFF)

try:
    print("Testing R5 (GPIO 24) ...")
    GPIO.output(R5, ON)
    print("  R5 ON")
    time.sleep(2)
    GPIO.output(R5, OFF)
    print("  R5 OFF")
    time.sleep(1)

    print("Testing R6 (GPIO 25) ...")
    GPIO.output(R6, ON)
    print("  R6 ON")
    time.sleep(2)
    GPIO.output(R6, OFF)
    print("  R6 OFF")
    time.sleep(1)

    print("Both ON together ...")
    GPIO.output(R5, ON)
    GPIO.output(R6, ON)
    print("  R5 + R6 ON")
    time.sleep(2)
    GPIO.output(R5, OFF)
    GPIO.output(R6, OFF)
    print("  R5 + R6 OFF")

    print("\n[DONE] Cutoff relay test complete.")

except KeyboardInterrupt:
    print("\n[STOP]")
finally:
    GPIO.output(R5, OFF)
    GPIO.output(R6, OFF)
    GPIO.cleanup()
    print("[CLEANUP] GPIO released.")
