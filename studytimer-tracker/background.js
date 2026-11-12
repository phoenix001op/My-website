// Padh Lo tracker. Counts active time and number of visits per website.
// Only the host name (e.g. youtube.com) is stored, never the full address.
// Event driven: no timers ticking every second, everything is kept in memory and saved in batches,
// so it adds no lag to browsing.
const IDLE_SECONDS = 60;
const MAX_CREDIT_MS = 120000; // never credit more than this in one go (sleep, crashes)
const KEEP_DAYS = 60;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

let days = {};   // { 'YYYY-MM-DD': { host: seconds } }
let opens = {};  // { 'YYYY-MM-DD': { host: times opened } }
let cur = null;  // { host, start }
let dirty = false;

const ready = chrome.storage.local.get(['days', 'opens', 'cur']).then((s) => {
  days = s.days || {}; opens = s.opens || {}; cur = s.cur || null;
});

let chain = Promise.resolve();
const enqueue = (fn) => (chain = chain.then(() => ready).then(fn).catch((e) => console.error(e)));

function addTime(host, from, to) {
  let t = from;
  while (t < to) {
    const midnight = new Date(t);
    midnight.setHours(24, 0, 0, 0);
    const end = Math.min(to, midnight.getTime());
    const key = dayKey(t);
    const day = (days[key] = days[key] || {});
    day[host] = Math.round(((day[host] || 0) + (end - t) / 1000) * 10) / 10;
    t = end;
  }
  dirty = true;
}

function addOpen(host, at) {
  const key = dayKey(at);
  const day = (opens[key] = opens[key] || {});
  day[host] = (day[host] || 0) + 1;
  dirty = true;
}

function prune() {
  [days, opens].forEach((obj) => {
    const keys = Object.keys(obj).sort();
    while (keys.length > KEEP_DAYS) delete obj[keys.shift()];
  });
}

async function flush() {
  if (!dirty) { await chrome.storage.local.set({ cur }); return; }
  prune();
  dirty = false;
  await chrome.storage.local.set({ days, opens, cur });
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

async function sync(save) {
  const now = Date.now();
  if (cur && cur.host) addTime(cur.host, Math.max(cur.start, now - MAX_CREDIT_MS), now);
  const host = await currentHost();
  if (host && (!cur || cur.host !== host)) addOpen(host, now); // a new site came to the front
  cur = host ? { host, start: now } : null;
  if (save) await flush();
}

const trigger = () => enqueue(() => sync(false));      // cheap, memory only
const triggerSave = () => enqueue(() => sync(true));   // also writes to storage (every 30 s)

chrome.idle.setDetectionInterval(IDLE_SECONDS);
chrome.alarms.create('tick', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(triggerSave);
chrome.tabs.onActivated.addListener(trigger);
chrome.tabs.onUpdated.addListener((id, change) => { if (change.url || 'audible' in change) trigger(); });
chrome.windows.onFocusChanged.addListener(trigger);
chrome.idle.onStateChanged.addListener(trigger);
chrome.runtime.onStartup.addListener(triggerSave);
chrome.runtime.onInstalled.addListener(triggerSave);
