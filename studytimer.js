// ========== STATE ==========
let interval = null;
let totalCs = 0;                    // centiseconds left on the countdown
let sessionTotalCs = 0;             // length of the current countdown (drives the ring)
let endAt = 0;                      // timestamp (ms) when the countdown reaches zero
let timerIsRunning = false;
let isPaused = true;
let isBreak = false;
let studyStartTime = null;          // when the current study segment started (ms)
let totalStudySecondsInSession = 0; // seconds studied but not yet turned into XP
let monthTimer = null;

let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let selectedCalendarDate = null;
let currentMusicTrack = 1;
const audioPlayer = new Audio();

// Ranks reset every month. XP bands:
const RANKS = [
  { name: 'Beginner', min: 0,   max: 100,  icon: 'fa-seedling' },
  { name: 'Learner',  min: 101, max: 200,  icon: 'fa-book-open-reader' },
  { name: 'Focused',  min: 201, max: 400,  icon: 'fa-brain' },
  { name: 'Elite',    min: 401, max: 750,  icon: 'fa-crown' },
  { name: 'Master',   min: 751, max: 1000, icon: 'fa-star' }
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const THEMES = ['night', 'notebook', 'board'];
const THEME_COLORS = { night: '#11151c', notebook: '#f1f3f7', board: '#16231f' };

const MUSIC_TRACKS = [
  'drifting-away-full-version-binaural-beats-409329.mp3',
  'https://cdn.pixabay.com/download/audio/2022/03/10/audio_4b8a1d9a4d.mp3',
  'https://cdn.pixabay.com/download/audio/2022/03/19/audio_1e5b5d9a4d.mp3',
  'https://cdn.pixabay.com/download/audio/2022/03/07/audio_8b8a1d9a4d.mp3'
];

const PAGES = ['appScreen', 'calendarPage', 'statsPage', 'screenPage', 'rankPage'];

// ========== SMALL HELPERS ==========
function pad(n) { return String(n).padStart(2, '0'); }

// Local dates (not UTC), so a day and a month change at local midnight.
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr() { return localDateStr(); }
function monthKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
}
function formatMinutes(m) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
}
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function listRow(left, right) {
  const row = document.createElement('div');
  row.className = 'list-row';
  const a = document.createElement('span');
  const b = document.createElement('span');
  a.textContent = left;
  b.textContent = right;
  row.append(a, b);
  return row;
}

// ========== STORAGE ==========
function getUser() {
  return localStorage.getItem('username') || null;
}

function getUserKey(key) {
  const user = getUser();
  return user ? `${user}_${key}` : key;
}

function getData(key, fallback = {}) {
  try {
    return JSON.parse(localStorage.getItem(getUserKey(key))) || fallback;
  } catch { return fallback; }
}

function setData(key, value) {
  localStorage.setItem(getUserKey(key), JSON.stringify(value));
}

// ========== THEME ==========
function syncThemeUI() {
  const name = document.documentElement.getAttribute('data-theme') || 'night';
  const meta = document.getElementById('themeColor');
  if (meta) meta.setAttribute('content', THEME_COLORS[name] || THEME_COLORS.night);
  document.querySelectorAll('[data-theme-btn]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.themeBtn === name));
  });
}

function setTheme(name) {
  if (!THEMES.includes(name)) return;
  document.documentElement.setAttribute('data-theme', name);
  try { localStorage.setItem('padhlo_theme', name); } catch (e) { /* private mode */ }
  syncThemeUI();
}

// ========== MUSIC ==========
function toggleMusicPlayer() {
  document.getElementById('musicPlayer').classList.toggle('hidden');
}

function playMusic() {
  if (audioPlayer.src) audioPlayer.play().catch(() => {});
}

function pauseMusic() {
  audioPlayer.pause();
}

function stopMusic() {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
}

function selectTrack(track, btn) {
  currentMusicTrack = track;
  document.querySelectorAll('.track-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  audioPlayer.src = MUSIC_TRACKS[track - 1];
  audioPlayer.loop = true;
  if (!audioPlayer.paused) audioPlayer.play().catch(() => {});
}

// ========== XP, RANKS AND THE MONTHLY RESET ==========
function calculateXP(minutes) {
  if (minutes >= 60) {
    const extraHalfHours = Math.floor((minutes - 60) / 30);
    return 50 + extraHalfHours * 25;
  } else if (minutes >= 30) {
    return 25;
  } else if (minutes >= 15) {
    return 10;
  } else if (minutes >= 5) {
    return 5;
  } else if (minutes >= 1) {
    return 1;
  }
  return 0;
}

function getRankInfo(xp) {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].min) index = i;
  }
  const next = RANKS[index + 1] || null;
  return {
    index,
    level: index + 1,
    rank: RANKS[index].name,
    icon: RANKS[index].icon,
    xp,
    next,
    xpNeeded: next ? next.min - xp : 0
  };
}

// XP is this month's XP. It goes back to 0 at the start of each month.
function getUserXP() {
  return getData('userData', { xp: 0 }).xp || 0;
}

function getUserLevel() {
  return getRankInfo(getUserXP());
}

function checkMonthRollover() {
  if (!getUser()) return;
  const data = getData('userData', null);
  if (!data) return;

  const nowKey = monthKey();
  if (data.month === nowKey) return;

  const history = getData('monthHistory', []);
  let archived = null;
  let migrated = false;

  if (!data.month) {
    // Data saved before monthly ranks existed: xp was an all-time total.
    // Rebuild this month's XP, and earlier months, from the XP history.
    const perMonth = {};
    getData('xpHistory', []).forEach(r => {
      if (r && r.date) {
        const k = String(r.date).slice(0, 7);
        perMonth[k] = (perMonth[k] || 0) + (r.xp || 0);
      }
    });
    data.lifetimeXP = Math.max(data.lifetimeXP || 0, data.xp || 0);
    Object.keys(perMonth).sort().forEach(k => {
      if (k < nowKey && !history.some(h => h.month === k)) {
        history.push({ month: k, xp: perMonth[k], rank: getRankInfo(perMonth[k]).rank });
      }
    });
    data.xp = perMonth[nowKey] || 0;
    migrated = true;
  } else {
    if (data.xp > 0 && !history.some(h => h.month === data.month)) {
      archived = { month: data.month, xp: data.xp, rank: getRankInfo(data.xp).rank };
      history.push(archived);
    }
    data.xp = 0;
  }

  data.month = nowKey;
  history.sort((a, b) => (a.month < b.month ? -1 : 1));
  setData('monthHistory', history);
  setData('userData', data);

  updateXPDisplay();
  renderHome();

  if (archived) {
    showNotification(`New month. You finished ${monthLabel(archived.month)} as ${archived.rank} with ${archived.xp} XP. Your rank is back to Beginner.`);
  } else if (migrated) {
    showNotification(`Ranks now reset every month. This month so far: ${data.xp} XP.`);
  }
}

// Returns the new rank name if this XP pushed the user up a rank, otherwise null.
function addXP(xpToAdd) {
  if (xpToAdd <= 0) return null;
  checkMonthRollover();

  const d = getData('userData', { xp: 0 });
  const before = getRankInfo(d.xp || 0).level;
  d.xp = (d.xp || 0) + xpToAdd;
  d.lifetimeXP = (d.lifetimeXP || 0) + xpToAdd;
  d.month = d.month || monthKey();
  setData('userData', d);

  const hist = getData('xpHistory', []);
  hist.push({ date: todayStr(), xp: xpToAdd, total: d.xp, timestamp: new Date().toISOString() });
  setData('xpHistory', hist);

  updateXPDisplay();

  const after = getRankInfo(d.xp);
  return after.level > before ? after.rank : null;
}

function resetNote() {
  const now = new Date();
  const lastDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDate - now.getDate() + 1;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `Resets on 1 ${MONTH_NAMES[next.getMonth()]}. ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left.`;
}

function updateXPDisplay() {
  const ul = getUserLevel();
  const label = monthLabel(monthKey());
  const toNext = ul.next ? `${ul.xpNeeded} XP to ${ul.next.name}` : 'Top rank reached this month.';
  const pct = Math.min(100, ul.xp / 10); // the bar covers 0 to 1000 XP

  setText('rankName', ul.rank);
  setText('rankXP', ul.xp);
  setText('rankMonth', label);
  setText('rankLevelText', `Rank ${ul.level} of ${RANKS.length}`);
  setText('rankToNext', toNext);
  setText('rankReset', resetNote());

  const fill = document.getElementById('rankFill');
  if (fill) fill.style.width = `${pct}%`;

  ['rankBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.rank = ul.level;
    const icon = el.querySelector('i');
    if (icon) icon.className = `fas ${ul.icon}`;
  });

  document.querySelectorAll('.rank-item').forEach(item => {
    const lv = parseInt(item.dataset.level, 10);
    item.classList.toggle('active', lv === ul.level);
    item.classList.toggle('reached', lv < ul.level);
  });

  renderRankHistory();
}

function renderRankHistory() {
  const el = document.getElementById('rankHistory');
  if (!el) return;
  el.innerHTML = '';
  const hist = getData('monthHistory', []).slice().sort((a, b) => (a.month < b.month ? 1 : -1)).slice(0, 6);
  if (!hist.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Nothing here yet. Your final rank for each month is saved when it resets.';
    el.appendChild(p);
    return;
  }
  hist.forEach(h => el.appendChild(listRow(monthLabel(h.month), `${h.rank}, ${h.xp} XP`)));
}

// ========== HOME SUMMARY ==========
function getStreak(studyData) {
  const counts = d => (studyData[localDateStr(d)] || 0) >= 15;
  const d = new Date();
  if (!counts(d)) d.setDate(d.getDate() - 1); // today does not break the streak until it is over
  let streak = 0;
  while (counts(d)) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function renderHome() {
  const studyData = getData('studyData', {});
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const todayMin = studyData[today] || 0;
  const yesterdayMin = studyData[localDateStr(yesterday)] || 0;
  const sessions = getData('studySessions', []).filter(s => s.date === today).length;
  const streak = getStreak(studyData);

  setText('todayTime', formatMinutes(todayMin));
  setText('todaySessions', sessions);
  setText('streakHome', `${streak} ${streak === 1 ? 'day' : 'days'}`);

  let delta = '';
  if (todayMin > 0 || yesterdayMin > 0) {
    if (yesterdayMin === 0) delta = 'Nothing recorded yesterday.';
    else if (todayMin > yesterdayMin) delta = `${formatMinutes(todayMin - yesterdayMin)} more than yesterday.`;
    else if (todayMin < yesterdayMin) delta = `${formatMinutes(yesterdayMin - todayMin)} less than yesterday.`;
    else delta = 'Same as yesterday.';
  }
  setText('todayDelta', delta);
}

// ========== TIMER ==========
function formatDisplay(cs) {
  const s = Math.ceil(cs / 100);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function readInputsCs() {
  const n = id => Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
  const secs = Math.min(24 * 3600, n('setHr') * 3600 + n('setMin') * 60 + n('setSec'));
  return secs * 100;
}

function setStatus(text) {
  setText('status', text);
}

function updateRing() {
  const fill = document.getElementById('ringFill');
  if (!fill) return;
  const frac = sessionTotalCs > 0 ? Math.min(1, totalCs / sessionTotalCs) : 0;
  fill.style.strokeDashoffset = String(100 * (1 - frac));
  fill.style.opacity = frac > 0 ? '1' : '0';
}

function updateTitle() {
  if (sessionTotalCs > 0 && totalCs > 0) {
    const s = Math.ceil(totalCs / 100);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const t = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    document.title = `${t} ${isBreak ? 'break' : 'focus'} | Padh Lo`;
  } else {
    document.title = 'Padh Lo';
  }
}

// Display, ring and tab title. Runs on every tick.
function paintTimer() {
  const active = timerIsRunning || totalCs > 0;
  setText('display', formatDisplay(active ? totalCs : readInputsCs()));
  updateRing();
  updateTitle();
}

// Everything above plus button states. Runs when the timer's state changes.
function renderTimer() {
  paintTimer();

  const card = document.getElementById('timerCard');
  const running = timerIsRunning && !isPaused;
  const state = running ? 'running' : (totalCs > 0 ? 'paused' : 'idle');
  if (card) {
    card.dataset.state = state;
    card.dataset.mode = isBreak ? 'break' : 'study';
  }

  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  if (startBtn) startBtn.disabled = running;
  if (pauseBtn) pauseBtn.disabled = !running;
  if (resetBtn) resetBtn.disabled = state === 'idle';
  setText('startLabel', state === 'paused' ? 'Resume' : 'Start');

  const cs = readInputsCs();
  document.querySelectorAll('.preset').forEach(b => {
    b.classList.toggle('active', state === 'idle' && cs === parseInt(b.dataset.min, 10) * 6000);
  });
}

// Shows the time typed into the boxes while nothing is running.
function previewFromInputs() {
  renderTimer();
}

function applyPreset(minutes) {
  if (timerIsRunning || totalCs > 0) return;
  document.getElementById('setHr').value = Math.floor(minutes / 60) || '';
  document.getElementById('setMin').value = minutes % 60 || '';
  document.getElementById('setSec').value = '';
  renderTimer();
}

function stopInterval() {
  if (interval) { clearInterval(interval); interval = null; }
}

// The countdown is based on a fixed end time, so it stays correct when the tab
// is in the background or the phone screen is locked.
function syncRemaining() {
  totalCs = Math.max(0, Math.round((endAt - Date.now()) / 10));
}

function startTimer() {
  if (timerIsRunning && !isPaused) return;

  if (totalCs <= 0) {
    totalCs = readInputsCs();
    if (totalCs <= 0) {
      showNotification('Set a time first, or pick a quick duration.');
      return;
    }
    sessionTotalCs = totalCs;
    isBreak = false;
  }

  const now = Date.now();
  isPaused = false;
  timerIsRunning = true;
  endAt = now + totalCs * 10;
  if (!isBreak) studyStartTime = now;

  setStatus(isBreak ? 'On a break' : 'Studying');
  if (!interval) interval = setInterval(tick, 200);
  renderTimer();
}

function tick() {
  if (isPaused || !timerIsRunning) return;
  syncRemaining();
  paintTimer();
  if (totalCs <= 0) {
    if (isBreak) finishBreak();
    else finishTimer();
  }
}

function saveStudySession(minutes, xpEarned) {
  if (minutes <= 0) return;
  const date = todayStr();

  const studyData = getData('studyData', {});
  studyData[date] = (studyData[date] || 0) + minutes;
  setData('studyData', studyData);

  const sessions = getData('studySessions', []);
  sessions.push({ date, duration: minutes, xp: xpEarned, timestamp: new Date().toISOString() });
  setData('studySessions', sessions);
}

function playEndSound() {
  try {
    const a = document.getElementById('endSound');
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch (e) { /* ignore */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

function finishTimer() {
  stopInterval();

  // Never count time after the countdown actually ended (e.g. phone was asleep).
  const endMoment = Math.min(Date.now(), endAt || Date.now());
  const segmentSeconds = studyStartTime ? Math.max(0, (endMoment - studyStartTime) / 1000) : 0;
  const totalMinutes = Math.floor((totalStudySecondsInSession + segmentSeconds) / 60);

  timerIsRunning = false;
  isPaused = true;
  totalCs = 0;
  sessionTotalCs = 0;
  studyStartTime = null;
  totalStudySecondsInSession = 0;

  const xpEarned = calculateXP(totalMinutes);
  if (totalMinutes > 0) {
    saveStudySession(totalMinutes, xpEarned);
    const up = addXP(xpEarned);
    setStatus(`Done. +${xpEarned} XP`);
    showNotification(`Session complete. ${totalMinutes} min studied, +${xpEarned} XP.` + (up ? ` Rank up: ${up}.` : ''));
  } else {
    setStatus('Timer finished');
  }

  renderTimer();
  renderHome();
  playEndSound();
}

function finishBreak() {
  stopInterval();
  timerIsRunning = false;
  isPaused = true;
  isBreak = false;
  totalCs = 0;
  sessionTotalCs = 0;
  setStatus('Break over. Back to studying.');
  showNotification('Break over. Time to study.');
  renderTimer();
  playEndSound();
}

function pauseTimer() {
  if (!timerIsRunning || isPaused) return;

  syncRemaining();
  if (totalCs <= 0) { // the countdown already ended between ticks
    if (isBreak) finishBreak(); else finishTimer();
    return;
  }

  stopInterval();
  isPaused = true;

  if (isBreak) {
    setStatus('Break paused');
    renderTimer();
    return;
  }

  if (studyStartTime) {
    totalStudySecondsInSession += (Date.now() - studyStartTime) / 1000;
    studyStartTime = null;
  }

  const minutes = Math.floor(totalStudySecondsInSession / 60);
  if (minutes > 0) {
    const xp = calculateXP(minutes);
    saveStudySession(minutes, xp);
    const up = addXP(xp);
    totalStudySecondsInSession -= minutes * 60; // keep the leftover seconds
    showNotification(`Paused. ${minutes} min saved, +${xp} XP.` + (up ? ` Rank up: ${up}.` : ''));
    setStatus(`Paused, +${xp} XP`);
  } else {
    setStatus('Paused');
  }

  renderTimer();
  renderHome();
}

function resetTimer() {
  stopInterval();
  timerIsRunning = false;
  isPaused = true;
  isBreak = false;
  totalCs = 0;
  sessionTotalCs = 0;
  endAt = 0;
  totalStudySecondsInSession = 0;
  studyStartTime = null;
  setStatus('Ready to study');
  renderTimer();
}

function startBreak(minutes) {
  // Time already studied is saved before the break starts.
  if (timerIsRunning && !isPaused && !isBreak) pauseTimer();
  resetTimer();

  isBreak = true;
  totalCs = minutes * 6000;
  sessionTotalCs = totalCs;
  timerIsRunning = true;
  isPaused = false;
  endAt = Date.now() + totalCs * 10;
  interval = setInterval(tick, 200);

  closePanels();
  setStatus(`${minutes} min break`);
  renderTimer();
}

// ========== NOTIFICATION ==========
function showNotification(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const n = document.createElement('div');
  n.className = 'toast';
  n.setAttribute('role', 'status');
  n.textContent = message;
  document.body.appendChild(n);

  setTimeout(() => {
    n.classList.add('leaving');
    setTimeout(() => n.remove(), 260);
  }, 4500);
}

// ========== CALENDAR ==========
function renderCalendar() {
  const data = getData('studyData', {});
  const calendarDays = document.getElementById('calendarDays');
  if (!calendarDays) return;

  setText('calendarMonthYear', `${MONTH_NAMES[currentCalendarMonth]} ${currentCalendarYear}`);

  const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
  const lastDate = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const today = new Date();

  calendarDays.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    calendarDays.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${currentCalendarYear}-${pad(currentCalendarMonth + 1)}-${pad(day)}`;
    const minutes = data[dateStr] || 0;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-day';
    cell.setAttribute('aria-label', `${day} ${MONTH_NAMES[currentCalendarMonth]}, ${minutes ? formatMinutes(minutes) + ' studied' : 'no study'}`);

    if (today.getFullYear() === currentCalendarYear && today.getMonth() === currentCalendarMonth && today.getDate() === day) {
      cell.classList.add('today');
    }
    if (selectedCalendarDate === dateStr) cell.classList.add('selected');

    const dayNum = document.createElement('span');
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    if (minutes) {
      cell.classList.add('has-data');
      const mins = document.createElement('span');
      mins.className = 'study-minutes';
      mins.textContent = minutes >= 60 ? `${Math.floor(minutes / 60)}h` : `${minutes}m`;
      cell.appendChild(mins);
    }

    cell.onclick = () => showDateDetails(dateStr, day);
    calendarDays.appendChild(cell);
  }

  const streak = getStreak(data);
  const streakEl = document.getElementById('streak');
  if (streakEl) {
    streakEl.innerHTML = '';
    streakEl.append('Current streak: ');
    const strong = document.createElement('strong');
    strong.textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;
    streakEl.append(strong, ' (a day counts at 15 min or more)');
  }
}

function changeCalendarMonth(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth < 0) { currentCalendarMonth = 11; currentCalendarYear--; }
  else if (currentCalendarMonth > 11) { currentCalendarMonth = 0; currentCalendarYear++; }
  selectedCalendarDate = null;
  renderCalendar();
  document.getElementById('dateDetails').classList.add('hidden');
}

function setDetail(id, label, value) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  if (!label) return;
  el.append(`${label}: `);
  const strong = document.createElement('strong');
  strong.textContent = value;
  el.appendChild(strong);
}

function showDateDetails(dateStr, day) {
  const minutes = getData('studyData', {})[dateStr] || 0;
  selectedCalendarDate = dateStr;

  setText('selectedDateTitle', `${day} ${MONTH_NAMES[currentCalendarMonth]} ${currentCalendarYear}`);

  if (minutes > 0) {
    const xp = getData('xpHistory', []).filter(r => r.date === dateStr).reduce((sum, r) => sum + (r.xp || 0), 0);
    setDetail('selectedDateStudyTime', 'Studied', formatMinutes(minutes));
    setDetail('selectedDateXP', 'XP earned', `${xp} XP`);
  } else {
    setDetail('selectedDateStudyTime', 'Studied', 'nothing recorded');
    setDetail('selectedDateXP', '', '');
  }

  document.getElementById('dateDetails').classList.remove('hidden');
  renderCalendar();
}

// ========== STATS ==========
function renderStats() {
  const studyData = getData('studyData', {});
  const sessions = getData('studySessions', []);
  const userData = getData('userData', { xp: 0 });
  const nowKey = monthKey();

  let totalMinutes = 0, weekMinutes = 0, monthMinutes = 0;
  const studyDays = Object.keys(studyData).filter(k => studyData[k] > 0).length;

  for (const [dateStr, mins] of Object.entries(studyData)) {
    totalMinutes += mins;
    if (dateStr.startsWith(nowKey)) monthMinutes += mins;
  }
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    weekMinutes += studyData[localDateStr(d)] || 0;
    d.setDate(d.getDate() - 1);
  }

  setText('totalStudyTime', formatMinutes(totalMinutes));
  setText('totalXP', userData.lifetimeXP != null ? userData.lifetimeXP : (userData.xp || 0));
  setText('studyDays', studyDays);
  setText('currentLevelStat', getUserLevel().rank);
  renderStatsChart();

  const weekly = document.getElementById('weekly');
  weekly.innerHTML = '';
  weekly.appendChild(listRow('Last 7 days', formatMinutes(weekMinutes)));

  const monthly = document.getElementById('monthly');
  monthly.innerHTML = '';
  monthly.appendChild(listRow('This month', formatMinutes(monthMinutes)));
  monthly.appendChild(listRow('XP this month', `${getUserXP()} XP`));

  const recentEl = document.getElementById('weeklyStats');
  recentEl.innerHTML = '';
  const recent = sessions.slice(-5).reverse();
  if (recent.length) {
    recent.forEach(s => recentEl.appendChild(listRow(s.date, `${formatMinutes(s.duration)}, +${s.xp} XP`)));
  } else {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No sessions yet. Start the timer to log one.';
    recentEl.appendChild(p);
  }

  const xpEl = document.getElementById('xpHistory');
  xpEl.innerHTML = '';
  const xpHist = getData('xpHistory', []).slice(-10).reverse();
  if (xpHist.length) {
    xpHist.forEach(r => xpEl.appendChild(listRow(r.date, `+${r.xp} XP`)));
  } else {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No XP yet. Finish or pause a session to earn some.';
    xpEl.appendChild(p);
  }
}

// ========== BAR CHART (shared by Stats and Screen time) ==========
// o: { labels[], stacks[][{value,color,cls}] (minutes), unit('min'), labelEvery, selected, dim[], onSelect(i), titles[] }
function niceMax(minutes) {
  const steps = [15, 30, 60, 120, 180, 240, 300, 360, 480, 600, 720, 960, 1200, 1440];
  for (const v of steps) if (minutes <= v) return v;
  return Math.ceil(minutes / 360) * 360;
}
function axisLabel(min) {
  if (min === 0) return '0';
  if (min < 60) return `${Math.round(min)}m`;
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}
function drawBarChart(el, o) {
  el.innerHTML = '';
  const totals = o.stacks.map(st => st.reduce((a, x) => a + x.value, 0));
  const max = niceMax(Math.max(0, ...totals));

  const axis = document.createElement('div');
  axis.className = 'chart-axis';
  [max, max / 2, 0].forEach(v => {
    const t = document.createElement('span');
    t.textContent = axisLabel(v);
    axis.appendChild(t);
  });

  const plot = document.createElement('div');
  plot.className = 'chart-plot';
  const grid = document.createElement('div');
  grid.className = 'chart-grid';
  grid.innerHTML = '<i></i><i></i><i></i>';
  const bars = document.createElement('div');
  bars.className = 'chart-bars';
  const labels = document.createElement('div');
  labels.className = 'chart-labels';

  o.stacks.forEach((stack, i) => {
    const col = document.createElement(o.onSelect ? 'button' : 'div');
    col.className = 'bar-col';
    if (o.onSelect) { col.type = 'button'; col.onclick = () => o.onSelect(i); }
    if (o.titles && o.titles[i]) {
      col.title = o.titles[i];
      col.setAttribute('aria-label', o.titles[i]);
    }
    const bar = document.createElement('div');
    bar.className = 'bar';
    const total = totals[i];
    bar.style.height = `${Math.min(100, (total / max) * 100)}%`;
    if (total > 0 && total / max < 0.015) bar.style.minHeight = '3px';
    const dimmed = o.selected != null && o.selected !== i;
    if (dimmed) bar.classList.add('bar--dim');
    else stack.forEach(seg => {
      if (seg.value <= 0) return;
      const d = document.createElement('div');
      d.className = `seg ${seg.cls || ''}`;
      d.style.flexGrow = String(seg.value);
      if (seg.color) d.style.background = seg.color;
      bar.appendChild(d);
    });
    col.appendChild(bar);
    bars.appendChild(col);

    const lab = document.createElement('span');
    const every = o.labelEvery || 1;
    lab.textContent = i % every === 0 ? o.labels[i] : '';
    if (o.selected === i) lab.classList.add('on');
    labels.appendChild(lab);
  });

  plot.append(grid, bars);
  const body = document.createElement('div');
  body.className = 'chart-body';
  body.append(plot, labels);
  el.append(axis, body);
}

// ========== STATS GRAPH ==========
let statsRange = '7d';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function setStatsRange(r) {
  statsRange = r;
  document.querySelectorAll('[data-range]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.range === r)));
  renderStatsChart();
}

function renderStatsChart() {
  const el = document.getElementById('statsChart');
  if (!el) return;
  const studyData = getData('studyData', {});
  const labels = [], vals = [], titles = [];
  const now = new Date();

  if (statsRange === '12m') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      let sum = 0;
      for (const [k, m] of Object.entries(studyData)) if (k.startsWith(key)) sum += m;
      labels.push(MONTH_NAMES[d.getMonth()].slice(0, 3));
      vals.push(sum);
      titles.push(`${monthLabel(key)}: ${formatMinutes(sum)}`);
    }
  } else {
    const days = statsRange === '30d' ? 30 : 7;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const m = studyData[localDateStr(d)] || 0;
      labels.push(days === 7 ? WEEKDAYS[d.getDay()] : String(d.getDate()));
      vals.push(m);
      titles.push(`${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}: ${formatMinutes(m)}`);
    }
  }

  const stacks = vals.map(v => [{ value: v, cls: 'seg-study' }]);
  drawBarChart(el, { labels, stacks, titles, labelEvery: statsRange === '30d' ? 5 : 1 });

  const total = vals.reduce((a, b) => a + b, 0);
  const unit = statsRange === '12m' ? 'month' : 'day';
  const avg = Math.round(total / vals.length);
  setText('statsChartNote', total > 0
    ? `Total ${formatMinutes(total)}. Average ${formatMinutes(avg)} per ${unit}.`
    : 'No study time in this range yet. Start the timer to fill the graph.');
}

// ========== SCREEN TIME ==========
// Data comes from the studytimer-tracker extension (websites), the desktop tracker (apps, via Import),
// and is stored per user as { 'YYYY-MM-DD': { 'youtube.com': seconds } }.
const ST_RULES = {
  productive: [
    'pw.live', 'physicswallah.live', 'pwskills.com', 'physicswallah', 'khanacademy.org', 'wikipedia.org', 'github.com', 'stackoverflow.com',
    'classroom.google.com', 'docs.google.com', 'coursera.org', 'leetcode.com', 'unacademy.com', 'vedantu.com',
    'byjus.com', 'w3schools.com', 'developer.mozilla.org', 'claude.ai', 'chatgpt.com', 'notion.so',
    'geeksforgeeks.org', 'desmos.com', 'geogebra.org', 'scholar.google.com', 'arxiv.org', 'ncert.nic.in',
    'nptel.ac.in', 'swayam.gov.in', 'toppr.com', 'doubtnut.com', 'phoenix001op.github.io',
    'code', 'devenv', 'pycharm', 'idea64', 'winword', 'excel', 'powerpnt', 'acrobat', 'onenote', 'sublime', 'notepad++', 'obsidian'
  ],
  distracting: [
    'instagram.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com', 'netflix.com', 'reddit.com',
    'snapchat.com', 'hotstar.com', 'primevideo.com', 'discord.com', 'twitch.tv', 'tiktok.com', 'pinterest.com',
    'sonyliv.com', 'jiocinema.com', 'zee5.com', 'crunchyroll.com', '9gag.com', 'store.steampowered.com',
    'steam', 'epicgames', 'roblox', 'minecraft', 'valorant', 'fortnite', 'bgmi', 'pubg', 'leagueclient', 'discord', 'gta'
  ]
};
const ST_NAMES = {
  'youtube.com': 'YouTube', 'instagram.com': 'Instagram', 'pw.live': 'PW', 'facebook.com': 'Facebook',
  'x.com': 'X', 'twitter.com': 'Twitter', 'reddit.com': 'Reddit', 'netflix.com': 'Netflix',
  'github.com': 'GitHub', 'google.com': 'Google', 'wikipedia.org': 'Wikipedia', 'claude.ai': 'Claude',
  'chatgpt.com': 'ChatGPT', 'web.whatsapp.com': 'WhatsApp Web', 'mail.google.com': 'Gmail',
  'docs.google.com': 'Google Docs', 'phoenix001op.github.io': 'Padh Lo', 'code': 'VS Code'
};
// YouTube channels that count as productive (study and coding). Anything else on YouTube is distracting.
// Tap a channel row to change one; your choice is remembered.
const YT_SEP = ' \u203a ';
const ST_YT_STUDY = /\b(pw|physics ?wallah|alakh|apna college|apnacollege|freecodecamp|code ?with ?harry|codewithharry|traversy|fireship|cs50|neso academy|khan academy|3blue1brown|mit opencourseware|nptel|take u forward|striver|gate smashers|love babbar|kunal kushwaha|programming with mosh|the coding train|web dev simplified|net ninja|sheriyans|chai aur code|hitesh choudhary|ncert|unacademy|vedantu|physics ?galaxy|organic chemistry tutor|crashcourse)\b/i;
const ST_CATS = ['productive', 'distracting', 'other'];
const ST_CAT_LABEL = { productive: 'Productive', distracting: 'Distracting', other: 'Others' };

let stView = 'daily';
let stDate = new Date();
let stOpenRow = null;
let stExtSeen = false; // the tracker said hello on this page load

function stIsSite(name) { return name.includes('.') && !/\.exe$/i.test(name); }

function stClassify(name) {
  if (name.startsWith('youtube.com' + YT_SEP)) {
    const ch = name.slice(('youtube.com' + YT_SEP).length);
    return ST_YT_STUDY.test(ch) ? 'productive' : 'distracting';
  }
  const n = name.toLowerCase().replace(/\.exe$/, '');
  for (const cat of ['distracting', 'productive']) {
    for (const rule of ST_RULES[cat]) {
      if (rule.includes('.')) {
        if (n === rule || n.endsWith('.' + rule)) return cat;
      } else if (!stIsSite(name) && (n === rule || n.includes(rule))) {
        return cat;
      }
    }
  }
  return 'other';
}
function stCategory(name) {
  const o = getData('stCategories', {});
  return ST_CATS.includes(o[name]) ? o[name] : stClassify(name);
}
function stSetCategory(name, cat) {
  const o = getData('stCategories', {});
  o[name] = cat;
  setData('stCategories', o);
  renderScreenTime();
}
function stDisplayName(name) {
  if (name.startsWith('youtube.com' + YT_SEP)) return name.slice(('youtube.com' + YT_SEP).length) + ' (YouTube)';
  if (ST_NAMES[name]) return ST_NAMES[name];
  if (stIsSite(name)) return name;
  const n = name.replace(/\.exe$/i, '');
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function formatDur(sec) {
  const m = Math.round(sec / 60);
  if (sec > 0 && m < 1) return '<1m';
  return formatMinutes(m);
}

function stDayData(dateStr) {
  const out = {};
  [getData('stSynced', {}), getData('stImported', {})].forEach(src => {
    const day = src[dateStr] || {};
    for (const [k, v] of Object.entries(day)) out[k] = (out[k] || 0) + (Number(v) || 0);
  });
  return out;
}
function stDayOpens(dateStr) {
  return getData('stOpens', {})[dateStr] || {};
}
function stSum(data) {
  const t = { productive: 0, distracting: 0, other: 0, total: 0 };
  for (const [name, sec] of Object.entries(data)) {
    const c = stCategory(name);
    t[c] += sec;
    t.total += sec;
  }
  return t;
}
function stWeekStart(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}
function stWeekDays(d) {
  const start = stWeekStart(d);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
function stFmtShort(d) { return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`; }

function setScreenView(v) {
  stView = v;
  stOpenRow = null;
  renderScreenTime();
}
function shiftScreenRange(dir) {
  const step = stView === 'weekly' ? 7 : 1;
  const next = new Date(stDate.getFullYear(), stDate.getMonth(), stDate.getDate() + dir * step);
  if (next > new Date()) return;
  stDate = next;
  stOpenRow = null;
  renderScreenTime();
}

function renderScreenTime() {
  const today = new Date();
  const days = stWeekDays(stDate);
  const weekly = stView === 'weekly';

  document.getElementById('stTabDaily').setAttribute('aria-selected', String(!weekly));
  document.getElementById('stTabWeekly').setAttribute('aria-selected', String(weekly));

  const perDay = days.map(d => stDayData(localDateStr(d)));
  const sums = perDay.map(stSum);
  const selIndex = days.findIndex(d => localDateStr(d) === localDateStr(stDate));

  // headline numbers
  let head, sub, legend;
  if (weekly) {
    legend = sums.reduce((a, s) => ({
      productive: a.productive + s.productive, distracting: a.distracting + s.distracting,
      other: a.other + s.other, total: a.total + s.total
    }), { productive: 0, distracting: 0, other: 0, total: 0 });
    head = legend.total;
    const thisWeek = localDateStr(stWeekStart(today)) === localDateStr(days[0]);
    sub = `${thisWeek ? 'This week' : 'Week'} - ${stFmtShort(days[0])} to ${stFmtShort(days[6])}`;
  } else {
    legend = sums[selIndex];
    head = legend.total;
    const isToday = localDateStr(stDate) === localDateStr(today);
    sub = `${isToday ? 'Today - ' : ''}${WEEKDAYS[stDate.getDay()]}, ${stFmtShort(stDate)}`;
  }
  setText('stTotal', formatDur(head));
  setText('stSub', sub);
  setText('stDist', formatDur(legend.distracting));
  setText('stProd', formatDur(legend.productive));
  setText('stOther', formatDur(legend.other));

  const nextStart = weekly ? new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate() + 7) : new Date(stDate.getFullYear(), stDate.getMonth(), stDate.getDate() + 1);
  document.getElementById('stNext').disabled = nextStart > today;

  // chart: Monday to Sunday of the selected week
  const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const stacks = sums.map(s => [
    { value: s.productive / 60, cls: 'seg-productive' },
    { value: s.other / 60, cls: 'seg-other' },
    { value: s.distracting / 60, cls: 'seg-distracting' }
  ]);
  drawBarChart(document.getElementById('stChart'), {
    labels: letters,
    stacks,
    selected: weekly ? null : selIndex,
    titles: days.map((d, i) => `${WEEKDAYS[d.getDay()]} ${stFmtShort(d)}: ${formatDur(sums[i].total)}`),
    onSelect: weekly ? null : (i) => {
      if (days[i] > today) return;
      stDate = days[i];
      stOpenRow = null;
      renderScreenTime();
    }
  });
  // dimmed bars still need a visible height: paint them with the neutral colour
  document.querySelectorAll('#stChart .bar--dim').forEach(b => { b.style.background = 'var(--st-dim)'; });

  renderScreenList(weekly ? perDay : [perDay[selIndex]], weekly ? days : [days[selIndex]]);
  renderTrackerStatus();
}

function renderScreenList(sources, dates) {
  const list = document.getElementById('stList');
  if (!list) return;
  if (!sources) {
    const days = stWeekDays(stDate);
    dates = stView === 'weekly' ? days : [stDate];
    sources = dates.map(d => stDayData(localDateStr(d)));
  }
  const openCount = {};
  (dates || []).forEach(d => {
    for (const [k, v] of Object.entries(stDayOpens(localDateStr(d)))) openCount[k] = (openCount[k] || 0) + v;
  });
  const merged = {};
  sources.forEach(day => { for (const [k, v] of Object.entries(day)) merged[k] = (merged[k] || 0) + v; });

  const q = (document.getElementById('stSearch').value || '').trim().toLowerCase();
  const rows = Object.entries(merged)
    .filter(([name]) => !q || name.toLowerCase().includes(q) || stDisplayName(name).toLowerCase().includes(q))
    .sort((a, b) => b[1] - a[1]);

  list.innerHTML = '';
  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'st-empty';
    p.textContent = q ? 'No apps match your search.' : (stExtSeen ? 'Nothing tracked for this period yet. Browse for a minute and your sites will show up here.' : 'Nothing to show yet. Follow the steps above to turn on Screen time.');
    list.appendChild(p);
    return;
  }

  rows.forEach(([name, sec]) => {
    const cat = stCategory(name);
    const open = stOpenRow === name;

    const wrap = document.createElement('div');
    wrap.className = 'st-item';

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'st-row';
    row.setAttribute('aria-expanded', String(open));

    const icon = document.createElement('span');
    icon.className = 'st-icon';
    if (stIsSite(name)) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(name.split(YT_SEP)[0])}&sz=64`;
      img.onerror = () => { img.remove(); icon.textContent = stDisplayName(name).charAt(0).toUpperCase(); };
      icon.appendChild(img);
    } else {
      icon.textContent = stDisplayName(name).charAt(0).toUpperCase();
    }

    const mid = document.createElement('span');
    mid.className = 'st-mid';
    const title = document.createElement('strong');
    title.textContent = stDisplayName(name);
    const chip = document.createElement('span');
    chip.className = `st-chip st-chip--${cat}`;
    chip.innerHTML = '<i class="dot"></i>';
    chip.append(ST_CAT_LABEL[cat] === 'Others' ? 'Others' : ST_CAT_LABEL[cat]);
    mid.append(title, chip);
    if (openCount[name]) {
      const op = document.createElement('span');
      op.className = 'st-opens';
      op.textContent = `Opened ${openCount[name]} ${openCount[name] === 1 ? 'time' : 'times'}`;
      mid.appendChild(op);
    }

    const time = document.createElement('span');
    time.className = 'st-time';
    time.textContent = formatDur(sec);

    const chev = document.createElement('i');
    chev.className = `fas fa-chevron-${open ? 'down' : 'right'} st-chev`;
    chev.setAttribute('aria-hidden', 'true');

    row.append(icon, mid, time, chev);
    row.onclick = () => { stOpenRow = open ? null : name; renderScreenList(sources, dates); };
    wrap.appendChild(row);

    if (open) {
      const pick = document.createElement('div');
      pick.className = 'st-pick';
      pick.setAttribute('role', 'group');
      pick.setAttribute('aria-label', `Category for ${stDisplayName(name)}`);
      ST_CATS.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `st-chip st-chip--${c}`;
        b.setAttribute('aria-pressed', String(c === cat));
        b.innerHTML = '<i class="dot"></i>';
        b.append(ST_CAT_LABEL[c]);
        b.onclick = () => stSetCategory(name, c);
        pick.appendChild(b);
      });
      wrap.appendChild(pick);
    }
    list.appendChild(wrap);
  });
}

const EXT_URLS = { brave: 'brave://extensions', chrome: 'chrome://extensions', edge: 'edge://extensions' };
function setInstallBrowser(br) {
  if (!EXT_URLS[br]) return;
  setText('stExtUrl', EXT_URLS[br]);
  document.querySelectorAll('[data-br]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.br === br)));
}
function copyExtUrl(btn) {
  const text = document.getElementById('stExtUrl').textContent;
  const done = () => { btn.innerHTML = '<i class="fas fa-check"></i> Copied'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copy'; }, 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => showNotification(`Type ${text} in the address bar.`));
  else showNotification(`Type ${text} in the address bar.`);
}
function trackerInstalled() {
  return stExtSeen || !!getData('stLastSync', 0);
}
function renderTrackerStatus() {
  const last = getData('stLastSync', 0);
  const card = document.getElementById('stInstall');
  if (card) card.classList.toggle('hidden', stExtSeen);
  const el = document.getElementById('stTrackerStatus');
  if (!el) return;
  if (stExtSeen) {
    el.textContent = 'Browser tracker connected. Websites update here automatically.';
  } else if (last && Date.now() - last < 10 * 60 * 1000) {
    el.textContent = 'Browser tracker connected. Websites sync while this page is open.';
  } else if (last) {
    el.textContent = `Browser tracker last synced ${new Date(last).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Open this page with the extension on to refresh.`;
  } else {
    el.textContent = 'No tracker detected yet. Install the extension to track websites, and import app data from the desktop tracker.';
  }
}

// Accepts { 'YYYY-MM-DD': { name: seconds } } and ignores anything else.
function stCleanDays(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [date, day] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day !== 'object') continue;
    for (const [name, sec] of Object.entries(day)) {
      const n = Number(sec);
      if (!name || name.length > 120 || !isFinite(n) || n <= 0 || n > 86400) continue;
      (out[date] = out[date] || {})[name] = n;
    }
  }
  return out;
}
// Same shape as stCleanDays but the numbers are whole counts of visits.
function stCleanOpens(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [date, day] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day !== 'object') continue;
    for (const [name, n] of Object.entries(day)) {
      const v = Math.floor(Number(n));
      if (!name || name.length > 120 || !isFinite(v) || v <= 0 || v > 5000) continue;
      (out[date] = out[date] || {})[name] = v;
    }
  }
  return out;
}
function stMerge(storeKey, incoming) {
  const store = getData(storeKey, {});
  let changed = 0;
  for (const [date, day] of Object.entries(incoming)) {
    for (const [name, sec] of Object.entries(day)) {
      const cur = (store[date] || {})[name] || 0;
      if (sec > cur) { (store[date] = store[date] || {})[name] = sec; changed++; }
    }
  }
  if (changed) setData(storeKey, store);
  return changed;
}

function importScreenTime(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      const days = stCleanDays(json && json.days ? json.days : json);
      const n = stMerge('stImported', days);
      showNotification(n ? `Imported ${n} entries.` : 'Nothing new in that file.');
      renderScreenTime();
    } catch (e) {
      showNotification('That file could not be read. Use the JSON made by the tracker.');
    }
  };
  reader.readAsText(file);
}

function requestTrackerSync() {
  window.postMessage({ source: 'padhlo-page', type: 'request' }, '*');
}

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (!d || d.source !== 'padhlo-tracker' || d.type !== 'screentime') return;
  if (!getUser()) return;
  stExtSeen = true;
  stMerge('stSynced', stCleanDays(d.days));
  stMerge('stOpens', stCleanOpens(d.opens));
  setData('stLastSync', Date.now());
  updateTrackerPrompt();
  const page = document.getElementById('screenPage');
  if (page && !page.classList.contains('hidden')) renderScreenTime();
});

// Banner on the home page until the tracker is installed. "Not now" hides it for a week.
function updateTrackerPrompt() {
  const el = document.getElementById('trackerPrompt');
  if (!el) return;
  let snoozed = false;
  try { snoozed = Date.now() < Number(localStorage.getItem('padhlo_tracker_snooze') || 0); } catch (e) { /* ignore */ }
  el.classList.toggle('hidden', stExtSeen || trackerInstalled() || snoozed);
}
function dismissTrackerPrompt() {
  try { localStorage.setItem('padhlo_tracker_snooze', String(Date.now() + 7 * 86400000)); } catch (e) { /* ignore */ }
  updateTrackerPrompt();
}

function openScreenTime() {
  setInstallBrowser(/Edg\//.test(navigator.userAgent) ? 'edge' : (navigator.brave ? 'brave' : (/Chrome\//.test(navigator.userAgent) ? 'chrome' : 'brave')));
  stDate = new Date();
  stOpenRow = null;
  showPage('screenPage');
  renderScreenTime();
  requestTrackerSync();
}
function closeScreenTime() { showPage('appScreen'); }

// ========== LOGIN / LOGOUT ==========
function login() {
  const input = document.getElementById('usernameInput');
  const name = input.value.trim();
  if (!name) { showInputError(); return; }
  localStorage.setItem('username', name);
  initApp();
}

function showInputError() {
  const input = document.getElementById('usernameInput');
  input.classList.add('is-error');
  input.placeholder = 'Please enter your name';
  input.focus();
  setTimeout(() => {
    input.classList.remove('is-error');
    input.placeholder = 'Your name';
  }, 1800);
}

function logout() {
  if (!confirm('Log out? Your data stays saved on this device.')) return;

  if (timerIsRunning && !isPaused) pauseTimer();
  resetTimer();
  stopMusic();
  closePanels();
  if (monthTimer) { clearInterval(monthTimer); monthTimer = null; }

  document.getElementById('musicPlayer').classList.add('hidden');
  PAGES.forEach(p => document.getElementById(p).classList.add('hidden'));
  document.getElementById('loginScreen').classList.remove('hidden');

  localStorage.removeItem('username');
  document.getElementById('usernameInput').value = '';
}

function initApp() {
  const name = getUser();
  if (!name) return;

  if (!getData('userData', null)) setData('userData', { xp: 0, lifetimeXP: 0, month: monthKey() });
  if (!getData('studyData', null)) setData('studyData', {});
  if (!getData('studySessions', null)) setData('studySessions', []);
  if (!getData('xpHistory', null)) setData('xpHistory', []);

  document.getElementById('loginScreen').classList.add('hidden');
  showPage('appScreen');

  setText('userName', name);
  checkMonthRollover();
  updateXPDisplay();
  renderHome();
  renderTimer();
  requestTrackerSync();
  setTimeout(updateTrackerPrompt, 1500); // give the extension a moment to say hello
  selectTrack(1, document.querySelector('.track-btn'));

  if (monthTimer) clearInterval(monthTimer);
  monthTimer = setInterval(checkMonthRollover, 60000);
}

// ========== PAGE NAVIGATION ==========
function showPage(id) {
  PAGES.forEach(p => document.getElementById(p).classList.toggle('hidden', p !== id));
  window.scrollTo(0, 0);
  if (id === 'appScreen') { updateXPDisplay(); renderHome(); }
}

function openCalendar() {
  currentCalendarMonth = new Date().getMonth();
  currentCalendarYear = new Date().getFullYear();
  selectedCalendarDate = null;
  document.getElementById('dateDetails').classList.add('hidden');
  showPage('calendarPage');
  renderCalendar();
}
function closeCalendar() { showPage('appScreen'); }

function openStats() {
  showPage('statsPage');
  renderStats();
}
function closeStats() { showPage('appScreen'); }

function openRank() {
  checkMonthRollover();
  showPage('rankPage');
  updateXPDisplay();
}
function closeRank() { showPage('statsPage'); renderStats(); }

// ========== PANELS ==========
function setPanel(panelId, buttonId, open) {
  document.getElementById(panelId).classList.toggle('hidden', !open);
  const btn = document.getElementById(buttonId);
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

function closePanels() {
  setPanel('breakOptions', 'breakToggle', false);
  setPanel('bgOptions', 'themeToggle', false);
}

function toggleBreak() {
  const open = document.getElementById('breakOptions').classList.contains('hidden');
  closePanels();
  setPanel('breakOptions', 'breakToggle', open);
}

function toggleBg() {
  const open = document.getElementById('bgOptions').classList.contains('hidden');
  closePanels();
  setPanel('bgOptions', 'themeToggle', open);
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  syncThemeUI();

  if (getUser()) initApp();

  // Catch up immediately when the tab or phone wakes up.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      tick();
      checkMonthRollover();
    }
  });

  // Save study time if the page is closed mid-session.
  window.addEventListener('pagehide', () => {
    if (timerIsRunning && !isPaused) pauseTimer();
  });
});
