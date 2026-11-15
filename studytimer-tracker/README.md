# Padh Lo screen time tracker

Supplies the **Screen time** page of the study timer (`studytimer.html`).

## Websites: browser extension (Chrome, Edge, Brave)
1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose this `studytimer-tracker` folder.
3. Browse as usual. Time and visits are counted only while a tab is in front and you are active (or a tab is playing audio). It reacts to tab changes instead of running a timer, and saves every 30 seconds.
4. Open the study timer page now and then. It syncs automatically, and the Screen time page shows the totals.

Only host names such as `youtube.com` are stored, never full addresses, and nothing leaves your computer. The tracker only talks to the study timer page on this site (the manifest and `content.js` both enforce that); no other website can read your data.
If you open the study timer from a local file named `studytimer.html`, turn on **Allow access to file URLs** for the extension.

## Apps: desktop tracker (Windows)
`desktop_tracker.py` logs which program is in front. The Screen time page no longer has an import button, so its output is not shown on the site for now.

## Categories
Sites and apps are sorted into Productive, Distracting or Others by a built-in list. Tap any row on the Screen time page to change it; your choice is remembered.


The study timer shows an install prompt until it detects the extension. After you change these files, rebuild `../studytimer-tracker.zip`, because the download button on the Screen time page uses it.
