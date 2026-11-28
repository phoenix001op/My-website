// Runs only on the study timer page. Tells the page the tracker is installed and hands it the saved totals.
const VERSION = chrome.runtime.getManifest().version;
let timer = null;

// Only the real study timer page may receive data, even if the manifest matches are ever widened.
const TIMER_ORIGINS = ['https://my-website-ep83.vercel.app', 'https://phoenix001op.github.io'];
const onTimerPage = () => /\/studytimer(\.html)?$/.test(location.pathname) &&
  (location.protocol === 'file:' || TIMER_ORIGINS.includes(location.origin));

function push() {
  if (!onTimerPage()) return;
  try {
    chrome.storage.local.get(['days', 'opens'], ({ days, opens }) => {
      window.postMessage({ source: 'padhlo-tracker', type: 'screentime', version: VERSION, days: days || {}, opens: opens || {} }, location.protocol === 'file:' ? '*' : location.origin);
    });
  } catch (e) { /* extension was reloaded; a page refresh fixes it */ }
}
function pushSoon() { clearTimeout(timer); timer = setTimeout(push, 1500); }

if (onTimerPage()) push();
try { chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && (c.days || c.opens)) pushSoon(); }); } catch (e) { /* ignore */ }
document.addEventListener('visibilitychange', () => { if (!document.hidden) push(); });
window.addEventListener('message', (e) => {
  if (e.source === window && e.data && e.data.source === 'padhlo-page' && e.data.type === 'request') push();
});
