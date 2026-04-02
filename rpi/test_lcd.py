#!/usr/bin/env python3
"""
test_lcd.py — I2C LCD Display Test for GridSentinel (Raspberry Pi 4B)
======================================================================
Works with any 16x2 or 20x4 LCD connected via PCF8574 I2C backpack.
Common addresses: 0x27 (most boards) or 0x3F (some Chinese clones)

Run:  python3 test_lcd.py
Requires: pip3 install smbus2
"""

import smbus2
import time
import sys

# ─── PCF8574 → HD44780 LCD pin mapping ────────────────────────────────────────
# Most I2C LCD backpacks wire the PCF8574 output bits like this:
#   Bit 7 → D7    Bit 6 → D6    Bit 5 → D5    Bit 4 → D4
#   Bit 3 → BL    Bit 2 → EN    Bit 1 → RW    Bit 0 → RS

PIN_RS  = 0x01   # Register Select  (0=command, 1=data)
PIN_RW  = 0x02   # Read/Write       (always 0 = write)
PIN_EN  = 0x04   # Enable strobe
PIN_BL  = 0x08   # Backlight

LCD_CHR = PIN_RS           # Send character (data mode)
LCD_CMD = 0x00             # Send command

# HD44780 commands
CMD_CLEAR        = 0x01
CMD_HOME         = 0x02
CMD_ENTRY_MODE   = 0x06   # increment cursor, no display shift
CMD_DISPLAY_ON   = 0x0C   # display on, cursor off, blink off
CMD_DISPLAY_OFF  = 0x08
CMD_FUNCTION_4BIT= 0x28   # 4-bit, 2 lines, 5x8 dots
CMD_FUNCTION_8BIT= 0x38   # 8-bit init sequence only

# Row start addresses for common LCD sizes
ROW_OFFSETS = {
    2: [0x00, 0x40],               # 16x2
    4: [0x00, 0x40, 0x14, 0x54],   # 20x4
}


class I2CLCD:
    """Driver for HD44780 LCDs connected via PCF8574 I2C backpack."""

    def __init__(self, bus: int = 1, address: int = 0x27,
                 cols: int = 16, rows: int = 2):
        self.bus     = smbus2.SMBus(bus)
        self.addr    = address
        self.cols    = cols
        self.rows    = rows
        self.bl      = PIN_BL   # backlight on by default
        self._init_lcd()

    # ── Low-level I2C write ───────────────────────────────────────────────────

    def _write_i2c(self, data: int):
        """Send one byte to the PCF8574."""
        self.bus.write_byte(self.addr, data | self.bl)

    def _pulse_enable(self, data: int):
        """Toggle the EN pin to latch the nibble."""
        time.sleep(0.0005)                        # data-setup time before EN rises
        self._write_i2c(data | PIN_EN)
        time.sleep(0.0005)                        # EN pulse-width hold
        self._write_i2c(data & ~PIN_EN)
        time.sleep(0.0001)                        # EN fall hold

    def _send_nibble(self, nibble: int, mode: int):
        """Send the upper 4 bits as one nibble."""
        self._write_i2c((nibble & 0xF0) | mode)
        self._pulse_enable((nibble & 0xF0) | mode)

    def _send_byte(self, byte: int, mode: int):
        """Send a full 8-bit value in two 4-bit nibbles."""
        self._send_nibble(byte & 0xF0, mode)          # high nibble
        self._send_nibble((byte << 4) & 0xF0, mode)   # low nibble

    # ── HD44780 command helpers ───────────────────────────────────────────────

    def command(self, cmd: int):
        self._send_byte(cmd, LCD_CMD)
        time.sleep(0.002)

    def write_char(self, char: str):
        self._send_byte(ord(char), LCD_CHR)

    # ── Public API ────────────────────────────────────────────────────────────

    def _init_lcd(self):
        """Initialise the HD44780 in 4-bit mode (3-step power-on sequence)."""
        time.sleep(0.1)                           # wait >40 ms after power-on
        self._send_nibble(0x30, LCD_CMD); time.sleep(0.0045)   # >4.1 ms
        self._send_nibble(0x30, LCD_CMD); time.sleep(0.0045)   # >4.1 ms
        self._send_nibble(0x30, LCD_CMD); time.sleep(0.0001)   # >100 µs
        self._send_nibble(0x20, LCD_CMD); time.sleep(0.001)    # switch to 4-bit
        self.command(CMD_FUNCTION_4BIT)
        self.command(CMD_DISPLAY_OFF)
        self.command(CMD_CLEAR)
        time.sleep(0.003)                         # clear needs >1.52 ms
        self.command(CMD_ENTRY_MODE)
        self.command(CMD_DISPLAY_ON)
        time.sleep(0.001)

    def clear(self):
        self.command(CMD_CLEAR)
        time.sleep(0.002)

    def home(self):
        self.command(CMD_HOME)
        time.sleep(0.002)

    def set_cursor(self, col: int, row: int):
        """Move cursor to (col, row). Both are 0-indexed."""
        row = max(0, min(row, self.rows - 1))
        col = max(0, min(col, self.cols - 1))
        self.command(0x80 | (ROW_OFFSETS[self.rows][row] + col))

    def print(self, text: str):
        """Write a string at the current cursor position."""
        for ch in text[:self.cols]:
            self.write_char(ch)

    def print_line(self, text: str, row: int, align: str = 'left'):
        """Write text on a full row, padded/aligned to fit the display width."""
        text = text[:self.cols]
        if align == 'center':
            text = text.center(self.cols)
        elif align == 'right':
            text = text.rjust(self.cols)
        else:
            text = text.ljust(self.cols)
        self.set_cursor(0, row)
        self.print(text)

    def backlight(self, on: bool):
        self.bl = PIN_BL if on else 0
        self._write_i2c(0)   # refresh backlight state

    def create_char(self, location: int, charmap: list):
        """Define a custom character (location 0-7, charmap = 8 bytes)."""
        location &= 0x07
        self.command(0x40 | (location << 3))
        for row_data in charmap:
            self._send_byte(row_data, LCD_CHR)
        self.command(0x80)   # return to DDRAM

    def close(self):
        self.clear()
        self.backlight(False)
        self.bus.close()


# ─── I2C scanner ──────────────────────────────────────────────────────────────

def scan_i2c(bus: int = 1) -> list[int]:
    """Return list of responding I2C addresses on the given bus."""
    found = []
    b = smbus2.SMBus(bus)
    for addr in range(0x03, 0x78):
        try:
            b.read_byte(addr)
            found.append(addr)
        except OSError:
            pass
    b.close()
    return found


# ─── Custom characters ────────────────────────────────────────────────────────

CHAR_HEART = [0x00, 0x0A, 0x1F, 0x1F, 0x0E, 0x04, 0x00, 0x00]
CHAR_CHECK = [0x00, 0x01, 0x03, 0x16, 0x1C, 0x08, 0x00, 0x00]
CHAR_BELL  = [0x04, 0x0E, 0x0E, 0x0E, 0x1F, 0x00, 0x04, 0x00]
CHAR_BOLT  = [0x10, 0x08, 0x04, 0x0E, 0x02, 0x01, 0x00, 0x00]   # lightning
CHAR_UP    = [0x04, 0x0E, 0x1F, 0x04, 0x04, 0x04, 0x04, 0x00]
CHAR_FULL  = [0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F, 0x1F]


# ─── Test sequence ────────────────────────────────────────────────────────────

def run_tests(lcd: I2CLCD):
    W = lcd.cols
    sep = '─' * W

    def pause(s=1.5): time.sleep(s)

    # ── Test 1: Basic text ────────────────────────────────────────────────────
    print("  [1] Basic text...")
    lcd.clear()
    lcd.print_line("GridSentinel", 0, align='center')
    lcd.print_line("LCD Test", 1, align='center')
    pause()

    # ── Test 2: Scrolling message ─────────────────────────────────────────────
    print("  [2] Scrolling message...")
    msg = "  Raspberry Pi 4B  I2C LCD Ready!  "
    lcd.clear()
    lcd.print_line(">> Scrolling <<", 0, align='center')
    for i in range(len(msg) - W + 1):
        lcd.set_cursor(0, 1)
        lcd.print(msg[i:i + W])
        time.sleep(0.12)
    pause(0.5)

    # ── Test 3: Custom characters ─────────────────────────────────────────────
    print("  [3] Custom characters...")
    lcd.create_char(0, CHAR_HEART)
    lcd.create_char(1, CHAR_CHECK)
    lcd.create_char(2, CHAR_BELL)
    lcd.create_char(3, CHAR_BOLT)
    lcd.clear()
    lcd.print_line("Custom chars:", 0)
    lcd.set_cursor(0, 1)
    for ch in [0, 1, 2, 3]:
        lcd.write_char(chr(ch))
        lcd.write_char(' ')
    pause()

    # ── Test 4: Cursor position ───────────────────────────────────────────────
    print("  [4] Cursor/position...")
    lcd.clear()
    lcd.print_line("Col test:", 0)
    for c in range(W):
        lcd.set_cursor(c, 1)
        lcd.write_char(str(c % 10))
        time.sleep(0.06)
    pause()

    # ── Test 5: All rows (20x4 only) ──────────────────────────────────────────
    if lcd.rows == 4:
        print("  [5] All 4 rows...")
        lcd.clear()
        for r in range(4):
            lcd.print_line(f"Row {r}: Hello Pi!", r)
            time.sleep(0.3)
        pause()

    # ── Test 6: Counter ───────────────────────────────────────────────────────
    print("  [6] Live counter...")
    lcd.clear()
    lcd.print_line("Counter test:", 0)
    for i in range(16):
        lcd.set_cursor(0, 1)
        lcd.print(f"  Count: {i:>4}   ")
        time.sleep(0.2)
    pause(0.5)

    # ── Test 7: Backlight blink ───────────────────────────────────────────────
    print("  [7] Backlight blink...")
    lcd.clear()
    lcd.print_line("Backlight test", 0, align='center')
    lcd.print_line("Blinking 3x...", 1, align='center')
    for _ in range(3):
        lcd.backlight(False); time.sleep(0.4)
        lcd.backlight(True);  time.sleep(0.4)
    pause(0.5)

    # ── Test 8: GridSentinel status display (real-world demo) ─────────────────
    print("  [8] GridSentinel live demo screen...")
    lcd.create_char(3, CHAR_BOLT)
    lcd.clear()
    if W >= 20:
        lcd.print_line("\x03 GridSentinel  \x03", 0, align='center')
        lcd.print_line("PS1:220V 12.4W  ", 1)
        lcd.print_line("PS2:219V  0.8W  ", 2)
        lcd.print_line("Status: NORMAL  ", 3)
    else:
        lcd.print_line("\x03GridSentinel\x03", 0, align='center')
        lcd.print_line("PS1 220V 12.4W", 1)
    pause(2)

    # ── Test 9: Overload alert demo ───────────────────────────────────────────
    print("  [9] Overload alert blink demo...")
    lcd.create_char(0, CHAR_BELL)
    for _ in range(4):
        lcd.clear()
        lcd.print_line("\x00 PS1 OVERLOAD \x00", 0, align='center')
        lcd.print_line("  Cut in 2s...  ", 1, align='center')
        time.sleep(0.4)
        lcd.clear()
        time.sleep(0.2)
    pause(0.3)

    # ── Done ──────────────────────────────────────────────────────────────────
    lcd.create_char(1, CHAR_CHECK)
    lcd.clear()
    lcd.print_line("\x01  All tests OK  \x01", 0, align='center')
    lcd.print_line("GridSentinel LCD", 1, align='center')


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print()
    print("╔══════════════════════════════════════════╗")
    print("║   GridSentinel — I2C LCD Test Script     ║")
    print("╚══════════════════════════════════════════╝")
    print()

    # Step 1: Scan I2C bus
    print("Scanning I2C bus 1...")
    found = scan_i2c(1)

    if not found:
        print("✗ No I2C devices found!")
        print()
        print("Checklist:")
        print("  1. Is SDA connected to Pi Pin 3 (GPIO2)?")
        print("  2. Is SCL connected to Pi Pin 5 (GPIO3)?")
        print("  3. Is VCC connected to Pi 5V (Pin 2 or 4)?")
        print("  4. Is GND connected to Pi GND (Pin 6)?")
        print("  5. Did you run: sudo raspi-config → Interface Options → I2C → Enable?")
        print("  6. Is smbus2 installed? Run: pip3 install smbus2")
        sys.exit(1)

    print(f"  Found {len(found)} device(s): " + ", ".join(f"0x{a:02X}" for a in found))

    # Step 2: Pick LCD address
    LCD_CANDIDATES = [0x27, 0x3F, 0x20, 0x38]
    lcd_addr = None
    for a in LCD_CANDIDATES:
        if a in found:
            lcd_addr = a
            break
    if lcd_addr is None:
        lcd_addr = found[0]
        print(f"  Note: No known LCD address found. Using first device: 0x{lcd_addr:02X}")
    else:
        print(f"  LCD address: 0x{lcd_addr:02X}")

    # Step 3: Ask display size
    print()
    print("Display size?")
    print("  1) 16x2  (most common)")
    print("  2) 20x4")
    try:
        choice = input("  Enter 1 or 2 [default=1]: ").strip()
    except (KeyboardInterrupt, EOFError):
        choice = '1'

    if choice == '2':
        cols, rows = 20, 4
    else:
        cols, rows = 16, 2

    print(f"  Using {cols}x{rows} LCD at 0x{lcd_addr:02X}")
    print()

    # Step 4: Init LCD
    try:
        lcd = I2CLCD(bus=1, address=lcd_addr, cols=cols, rows=rows)
    except Exception as e:
        print(f"✗ Failed to init LCD: {e}")
        print()
        print("Check your wiring and try again.")
        sys.exit(1)

    print("✓ LCD initialised successfully")
    print()
    print("Running test sequence (press Ctrl+C to stop)...")
    print()

    try:
        run_tests(lcd)
        print()
        print("✓ All tests passed!")
    except KeyboardInterrupt:
        print()
        print("Stopped by user.")
    finally:
        lcd.clear()
        lcd.print_line("Test complete!", 0, align='center')
        lcd.print_line("GridSentinel", 1, align='center')
        time.sleep(2)
        lcd.close()
        print("LCD cleared and closed.")


if __name__ == '__main__':
    main()
