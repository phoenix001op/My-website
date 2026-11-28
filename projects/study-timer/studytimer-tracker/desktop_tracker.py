"""Padh Lo desktop app tracker (Windows only, no extra packages needed).

Counts the time each program is in front while you are active, and saves it to
padhlo_apps.json next to this file. Browsers are skipped because the browser
extension already counts websites.

Run:      python desktop_tracker.py
Stop:     Ctrl+C (it also saves every 30 seconds)
Then in the study timer: Screen time > Import data > pick padhlo_apps.json
"""
import ctypes
import json
import os
import sys
import time
from ctypes import wintypes
from datetime import datetime

if os.name != 'nt':
    sys.exit('This tracker only works on Windows.')

STEP = 5            # seconds between checks
IDLE_LIMIT = 60     # seconds without keyboard or mouse before time stops counting
SKIP = {'chrome', 'msedge', 'firefox', 'brave', 'opera', 'vivaldi', 'lockapp', 'searchhost',
        'startmenuexperiencehost', 'shellexperiencehost', 'applicationframehost', 'python', 'pythonw'}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'padhlo_apps.json')

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
kernel32.OpenProcess.restype = wintypes.HANDLE


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [('cbSize', wintypes.UINT), ('dwTime', wintypes.DWORD)]


def idle_seconds():
    info = LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(info)
    user32.GetLastInputInfo(ctypes.byref(info))
    return (kernel32.GetTickCount() - info.dwTime) / 1000.0


def foreground_app():
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    handle = kernel32.OpenProcess(0x1000, False, pid.value)  # PROCESS_QUERY_LIMITED_INFORMATION
    if not handle:
        return None
    try:
        buf = ctypes.create_unicode_buffer(512)
        size = wintypes.DWORD(512)
        if not kernel32.QueryFullProcessImageNameW(handle, 0, buf, ctypes.byref(size)):
            return None
        return os.path.basename(buf.value)
    finally:
        kernel32.CloseHandle(handle)


def load():
    try:
        with open(OUT, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save(data):
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1)
    os.replace(tmp, OUT)


def main():
    data = load()
    last_save = time.time()
    print(f'Tracking apps. Saving to {OUT}\nPress Ctrl+C to stop.')
    try:
        while True:
            time.sleep(STEP)
            if idle_seconds() > IDLE_LIMIT:
                continue
            exe = foreground_app()
            if exe:
                name = exe[:-4] if exe.lower().endswith('.exe') else exe
                if name.lower() not in SKIP:
                    day = data.setdefault(datetime.now().strftime('%Y-%m-%d'), {})
                    day[name] = round(day.get(name, 0) + STEP, 1)
            if time.time() - last_save >= 30:
                save(data)
                last_save = time.time()
    except KeyboardInterrupt:
        pass
    finally:
        save(data)
        print('Saved.')


if __name__ == '__main__':
    main()
