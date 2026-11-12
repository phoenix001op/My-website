# Padh Lo screen time tracker

Feeds the **Screen time** page of the study timer (`studytimer.html`).

## Websites: browser extension (Chrome, Edge, Brave)
1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `studytimer-tracker` folder.
3. Browse as usual. Time and visits are counted only while a tab is in front and you are active (or a tab is playing audio). It is event driven and saves in batches every 30 seconds, so it does not slow the browser.
4. Open the study timer page now and then. It syncs automatically, and the Screen time page shows the totals.

Only host names such as `youtube.com` are stored, never full addresses, and nothing leaves your computer.
If you open the study timer from a local file, turn on **Allow access to file URLs** for the extension.

## Apps: desktop tracker (Windows)
1. Install Python 3, then run `python desktop_tracker.py` and leave it running.
2. In the study timer, open **Screen time > Import data** and choose `padhlo_apps.json`.
   Importing again later only adds the new time.

## Categories
Sites and apps are sorted into Productive, Distracting or Others by a built-in list. Tap any row on the Screen time page to change it; your choice is remembered.


The study timer shows an install prompt until it detects the extension. After changing these files, rebuild `../studytimer-tracker.zip` (the download button on the Screen time page uses it).
