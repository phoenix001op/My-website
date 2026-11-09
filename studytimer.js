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

const PAGES = ['appScreen', 'todoPage', 'calendarPage', 'statsPage', 'rankPage'];

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
  const el = document.getElementById('currentXP');
  if (el) { el.classList.add('xp-gain'); setTimeout(() => el.classList.remove('xp-gain'), 500); }

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

  setText('currentXP', ul.xp);
  setText('homeRank', ul.rank);
  setText('homeMonth', label);
  setText('rankName', ul.rank);
  setText('rankXP', ul.xp);
  setText('rankMonth', label);
  setText('rankLevelText', `Rank ${ul.level} of ${RANKS.length}`);
  setText('xpToNext', toNext);
  setText('rankToNext', toNext);
  setText('homeReset', resetNote());
  setText('rankReset', resetNote());

  ['xpProgressFill', 'rankFill'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.width = `${pct}%`;
  });

  ['homeBadge', 'rankBadge'].forEach(id => {
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

// ========== TASKS ==========
function getTodos() {
  return getData('todos', []);
}

function saveTodos(todos) {
  setData('todos', todos);
}

function renderTodos() {
  const todos = getTodos();
  const list = document.getElementById('todoList');
  const progress = document.getElementById('todoProgress');
  if (!list) return;

  list.innerHTML = '';

  if (todos.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'todo-empty';
    empty.textContent = 'No tasks yet. Add your first one above.';
    list.appendChild(empty);
    if (progress) progress.textContent = '0 of 0 done';
    return;
  }

  const done = todos.filter(t => t.done).length;
  if (progress) progress.textContent = `${done} of ${todos.length} done`;

  todos.forEach((todo, i) => {
    const item = document.createElement('div');
    item.className = `todo-item${todo.done ? ' done' : ''}`;

    const checkbox = document.createElement('button');
    checkbox.className = 'todo-check';
    checkbox.setAttribute('role', 'checkbox');
    checkbox.setAttribute('aria-checked', String(!!todo.done));
    checkbox.setAttribute('aria-label', `Mark "${todo.text}" as done`);
    checkbox.innerHTML = todo.done ? '<i class="fas fa-check"></i>' : '';
    checkbox.onclick = () => toggleTodo(i);

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'todo-delete';
    del.setAttribute('aria-label', `Delete "${todo.text}"`);
    del.innerHTML = '<i class="fas fa-trash"></i>';
    del.onclick = () => deleteTodo(i);

    item.append(checkbox, text, del);
    list.appendChild(item);
  });
}

function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();
  if (!text) return;

  const todos = getTodos();
  todos.push({ text, done: false, createdAt: new Date().toISOString() });
  saveTodos(todos);
  input.value = '';
  renderTodos();
}

function toggleTodo(index) {
  const todos = getTodos();
  if (todos[index]) {
    todos[index].done = !todos[index].done;
    saveTodos(todos);
    renderTodos();
  }
}

function deleteTodo(index) {
  const todos = getTodos();
  todos.splice(index, 1);
  saveTodos(todos);
  renderTodos();
}

function clearDoneTodos() {
  saveTodos(getTodos().filter(t => !t.done));
  renderTodos();
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
  if (!getData('todos', null)) setData('todos', []);

  document.getElementById('loginScreen').classList.add('hidden');
  showPage('appScreen');

  setText('userName', name);
  checkMonthRollover();
  updateXPDisplay();
  renderHome();
  renderTimer();
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

function openTodo() {
  showPage('todoPage');
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  setText('todoDateLabel', new Date().toLocaleDateString('en-IN', opts));
  renderTodos();
}
function closeTodo() { showPage('appScreen'); }

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
function closeRank() { showPage('appScreen'); }

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
