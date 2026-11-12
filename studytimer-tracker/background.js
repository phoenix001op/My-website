// Counts active time per website. Only the host name (e.g. youtube.com) is stored, never the full address.
const IDLE_SECONDS = 60;
const MAX_CREDIT_MS = 120000; // never credit more than this in one go (sleep, crashes)
const KEEP_DAYS = 60;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

let chain = Promise.resolve();
const enqueue = (fn) => (chain = chain.then(fn).catch((e) => console.error(e)));

async function addTime(host, from, to) {
  if (!host || to <= from) return;
  const { days = {} } = await chrome.storage.local.get('days');
  let t = from;
  while (t < to) {
    const midnight = new Date(t);
    midnight.setHours(24, 0, 0, 0);
    const end = Math.min(to, midnight.getTime());
    const key = dayKey(t);
    days[key] = days[key] || {};
    days[key][host] = Math.round(((days[key][host] || 0) + (end - t) / 1000) * 10) / 10;
    t = end;
  }
  const keys = Object.keys(days).sort();
  while (keys.length > KEEP_DAYS) delete days[keys.shift()];
  await chrome.storage.local.set({ days });
}

async function currentHost() {
  const state = await chrome.idle.queryState(IDLE_SECONDS);
  if (state === 'locked') return null;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win || !win.focused) return null; // another program is in front
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab || !tab.url) return null;
  if (state === 'idle' && !tab.audible) return null; // away from keyboard, but music or video still counts
  try {
    const u = new URL(tab.url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '');
  } catch (e) { return null; }
}

async function sync() {
  const now = Date.now();
  const { cur } = await chrome.storage.local.get('cur');
  if (cur && cur.host) await addTime(cur.host, Math.max(cur.start, now - MAX_CREDIT_MS), now);
  const host = await currentHost();
  await chrome.storage.local.set({ cur: host ? { host, start: now } : null });
}
const trigger = () => enqueue(sync);

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(trigger);
chrome.tabs.onActivated.addListener(trigger);
chrome.tabs.onUpdated.addListener((id, change) => { if (change.url || change.status === 'complete' || 'audible' in change) trigger(); });
chrome.windows.onFocusChanged.addListener(trigger);
chrome.idle.onStateChanged.addListener(trigger);
chrome.runtime.onStartup.addListener(trigger);
chrome.runtime.onInstalled.addListener(trigger);
