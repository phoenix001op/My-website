// ========== GLOBAL VARIABLES ==========
let interval = null;
let totalCs = 0;          // centiseconds remaining
let timerIsRunning = false;
let isPaused = true;
let studyStartTime = null;  // when current study segment started (ms)
let totalStudySecondsInSession = 0; // accumulated seconds studied before latest segment
let lastTickTime = null;

let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let currentMusicTrack = 1;
let audioPlayer = new Audio();

// Level system
const LEVELS = [
  { name: "Beginner",  minXP: 0,   maxXP: 50   },
  { name: "Learner",   minXP: 51,  maxXP: 150  },
  { name: "Focused",   minXP: 151, maxXP: 400  },
  { name: "Elite",     minXP: 401, maxXP: 750  },
  { name: "Master",    minXP: 751, maxXP: 1000 }
];

const MUSIC_TRACKS = [
  "drifting-away-full-version-binaural-beats-409329.mp3",
  "https://cdn.pixabay.com/download/audio/2022/03/10/audio_4b8a1d9a4d.mp3",
  "https://cdn.pixabay.com/download/audio/2022/03/19/audio_1e5b5d9a4d.mp3",
  "https://cdn.pixabay.com/download/audio/2022/03/07/audio_8b8a1d9a4d.mp3"
];

// ========== STORAGE HELPERS ==========
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

// ========== MUSIC FUNCTIONS ==========
function toggleMusicPlayer() {
  const player = document.getElementById('musicPlayer');
  player.classList.toggle('hidden');
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

// ========== XP & LEVEL SYSTEM ==========
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

function getUserXP() {
  const d = getData('userData', { xp: 0 });
  return d.xp || 0;
}

function getUserLevel() {
  const xp = getUserXP();
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXP && xp <= LEVELS[i].maxXP) {
      return {
        level: i + 1,
        rank: LEVELS[i].name,
        currentXP: xp,
        maxXP: LEVELS[i].maxXP,
        minXP: LEVELS[i].minXP,
        xpNeeded: Math.max(0, LEVELS[i].maxXP - xp + 1)
      };
    }
  }
  // Master level (max)
  return { level: 5, rank: "Master", currentXP: xp, maxXP: 1000, minXP: 751, xpNeeded: 0 };
}

function addXP(xpToAdd) {
  if (xpToAdd <= 0) return;
  const d = getData('userData', { xp: 0 });
  d.xp = (d.xp || 0) + xpToAdd;
  setData('userData', d);

  const hist = getData('xpHistory', []);
  hist.push({ date: todayStr(), xp: xpToAdd, total: d.xp, timestamp: new Date().toISOString() });
  setData('xpHistory', hist);

  updateXPDisplay();
  const el = document.getElementById('currentXP');
  if (el) { el.classList.add('xp-gain'); setTimeout(() => el.classList.remove('xp-gain'), 500); }
}

function updateXPDisplay() {
  const ul = getUserLevel();
  const xpEl = document.getElementById('currentXP');
  const lvlEl = document.getElementById('currentLevel');
  if (!xpEl) return;

  xpEl.textContent = ul.currentXP;
  lvlEl.textContent = ul.level;

  const range = ul.maxXP - ul.minXP;
  const filled = ul.currentXP - ul.minXP;
  const pct = range > 0 ? Math.min(100, (filled / range) * 100) : 100;

  const fill1 = document.getElementById('xpProgressFill');
  const fill2 = document.getElementById('levelProgressFill');
  if (fill1) fill1.style.width = `${pct}%`;
  if (fill2) fill2.style.width = `${pct}%`;

  const xpToNext = ul.xpNeeded;
  const xpNextEl = document.getElementById('xpToNext');
  if (xpNextEl) xpNextEl.textContent = xpToNext > 0 ? `${xpToNext} XP to next level` : 'Max level reached!';

  const rankEl = document.getElementById('currentRank');
  if (rankEl) rankEl.textContent = ul.rank;
  const lvNumEl = document.getElementById('levelNumber');
  if (lvNumEl) lvNumEl.textContent = ul.level;
  const rankXpEl = document.getElementById('rankCurrentXP');
  if (rankXpEl) rankXpEl.textContent = ul.currentXP;
  const rankNextEl = document.getElementById('rankXpToNext');
  if (rankNextEl) rankNextEl.textContent = xpToNext;

  document.querySelectorAll('.level-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.level) === ul.level) item.classList.add('active');
  });
}

// ========== TIMER FUNCTIONS ==========
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDisplay(cs) {
  const s = Math.floor(cs / 100);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function updateDisplay() {
  const el = document.getElementById('display');
  if (el) el.textContent = formatDisplay(totalCs);
}

function setStatus(html) {
  const el = document.getElementById('status');
  if (el) el.innerHTML = html;
}

function startTimer() {
  if (timerIsRunning && !isPaused) return; // already running

  // If timer is at 0, read inputs
  if (totalCs <= 0) {
    const h = parseInt(document.getElementById('setHr').value) || 0;
    const m = parseInt(document.getElementById('setMin').value) || 0;
    const s = parseInt(document.getElementById('setSec').value) || 0;
    totalCs = (h * 3600 + m * 60 + s) * 100;

    if (totalCs <= 0) {
      showNotification('⚠️ Please set a time first!');
      return;
    }
  }

  isPaused = false;
  timerIsRunning = true;
  studyStartTime = Date.now();
  lastTickTime = Date.now();

  setStatus('<i class="fas fa-book"></i> Studying...');

  if (!interval) {
    interval = setInterval(tick, 100);
  }
}

function tick() {
  if (isPaused || !timerIsRunning) return;

  const now = Date.now();
  const elapsed = now - lastTickTime;
  lastTickTime = now;

  const elapsedCs = Math.round(elapsed / 10);
  if (elapsedCs <= 0) return;

  totalCs = Math.max(0, totalCs - elapsedCs);
  updateDisplay();

  if (totalCs <= 0) {
    finishTimer();
  }
}

function getStudiedMinutes() {
  // Minutes from previous segments + current running segment
  let secondsSoFar = totalStudySecondsInSession;
  if (timerIsRunning && !isPaused && studyStartTime) {
    secondsSoFar += (Date.now() - studyStartTime) / 1000;
  }
  return Math.floor(secondsSoFar / 60);
}

function saveStudySession(minutes, xpEarned) {
  if (minutes <= 0) return;

  const date = todayStr();

  // Save study minutes for calendar
  const studyData = getData('studyData', {});
  studyData[date] = (studyData[date] || 0) + minutes;
  setData('studyData', studyData);

  // Save session log
  const sessions = getData('studySessions', []);
  sessions.push({ date, duration: minutes, xp: xpEarned, timestamp: new Date().toISOString() });
  setData('studySessions', sessions);
}

function finishTimer() {
  clearInterval(interval);
  interval = null;
  timerIsRunning = false;
  isPaused = true;

  // Calculate how long this segment was
  let segmentSeconds = 0;
  if (studyStartTime) {
    segmentSeconds = (Date.now() - studyStartTime) / 1000;
  }
  const totalSeconds = totalStudySecondsInSession + segmentSeconds;
  const totalMinutes = Math.floor(totalSeconds / 60);

  const xpEarned = calculateXP(totalMinutes);
  if (totalMinutes > 0) {
    saveStudySession(totalMinutes, xpEarned);
    addXP(xpEarned);
    setStatus(`<i class="fas fa-check-circle"></i> Done! +${xpEarned} XP 🎉`);
    showNotification(`🎉 Session complete! +${xpEarned} XP for ${totalMinutes} min`);
  } else {
    setStatus('<i class="fas fa-check-circle"></i> Timer finished!');
  }

  // Reset tracking
  totalStudySecondsInSession = 0;
  studyStartTime = null;
  totalCs = 0;
  updateDisplay();

  try { document.getElementById('endSound').play(); } catch(e) {}
}

function pauseTimer() {
  if (!timerIsRunning || isPaused) return;

  // Accumulate seconds from this segment
  if (studyStartTime) {
    totalStudySecondsInSession += (Date.now() - studyStartTime) / 1000;
    studyStartTime = null;
  }

  isPaused = true;
  const minutes = Math.floor(totalStudySecondsInSession / 60);

  if (minutes > 0) {
    const xp = calculateXP(minutes);
    saveStudySession(minutes, xp);
    addXP(xp);
    totalStudySecondsInSession = 0; // reset after awarding
    showNotification(`⏸️ Paused — +${xp} XP for ${minutes} min`);
    setStatus(`<i class="fas fa-pause-circle"></i> Paused (+${xp} XP)`);
  } else {
    setStatus('<i class="fas fa-pause-circle"></i> Paused');
  }
}

function resetTimer() {
  clearInterval(interval);
  interval = null;
  timerIsRunning = false;
  isPaused = true;
  totalCs = 0;
  totalStudySecondsInSession = 0;
  studyStartTime = null;
  lastTickTime = null;
  updateDisplay();
  setStatus('<i class="fas fa-book-open"></i> Ready to study');
}

function startBreak(minutes) {
  resetTimer();
  totalCs = minutes * 60 * 100;
  updateDisplay();
  setStatus(`<i class="fas fa-coffee"></i> ${minutes} min break`);
  // Don't auto-start, let user press Start — or auto-start:
  isPaused = false;
  timerIsRunning = true;
  studyStartTime = null; // break doesn't count as study
  lastTickTime = Date.now();
  interval = setInterval(function() {
    if (!timerIsRunning || isPaused) return;
    const now = Date.now();
    const cs = Math.round((now - lastTickTime) / 10);
    lastTickTime = now;
    totalCs = Math.max(0, totalCs - cs);
    updateDisplay();
    if (totalCs <= 0) {
      clearInterval(interval);
      interval = null;
      timerIsRunning = false;
      isPaused = true;
      setStatus('<i class="fas fa-book-open"></i> Break over! Back to study 💪');
      try { document.getElementById('endSound').play(); } catch(e) {}
      showNotification('☕ Break over! Time to study!');
    }
  }, 100);
}

// ========== NOTIFICATION ==========
function showNotification(message) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const n = document.createElement('div');
  n.className = 'notification';
  n.innerHTML = `<i class="fas fa-bell"></i> ${message}`;
  n.style.cssText = `
    position: fixed; top: 16px; right: 16px;
    background: linear-gradient(45deg, #ff7ad9, #7597de);
    color: white; padding: 14px 20px; border-radius: 14px;
    z-index: 9999; animation: slideIn 0.3s ease;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    font-family: 'Nunito', sans-serif; font-weight: 700;
    font-size: 14px; max-width: calc(100vw - 32px);
    word-break: break-word;
  `;
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => n.remove(), 300);
  }, 3500);
}

// ========== TODO FUNCTIONS ==========
function getTodos() {
  return getData('todos', []);
}

function saveTodos(todos) {
  setData('todos', todos);
}

function renderTodos() {
  const todos = getTodos();
  const list = document.getElementById('todoList');
  const empty = document.getElementById('todoEmpty');
  const progress = document.getElementById('todoProgress');

  if (!list) return;

  // Clear except empty placeholder
  list.innerHTML = '';

  if (todos.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'todo-empty';
    emptyDiv.innerHTML = '<i class="fas fa-clipboard-list"></i><br>No tasks yet. Add something!';
    list.appendChild(emptyDiv);
    if (progress) progress.textContent = '0 / 0 done';
    return;
  }

  const done = todos.filter(t => t.done).length;
  if (progress) progress.textContent = `${done} / ${todos.length} done`;

  todos.forEach((todo, i) => {
    const item = document.createElement('div');
    item.className = `todo-item${todo.done ? ' done' : ''}`;

    const checkbox = document.createElement('button');
    checkbox.className = 'todo-checkbox';
    checkbox.innerHTML = todo.done ? '<i class="fas fa-check"></i>' : '';
    checkbox.onclick = () => toggleTodo(i);

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const del = document.createElement('button');
    del.className = 'todo-delete-btn';
    del.innerHTML = '<i class="fas fa-trash"></i>';
    del.onclick = () => deleteTodo(i);

    item.appendChild(checkbox);
    item.appendChild(text);
    item.appendChild(del);
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
  const todos = getTodos().filter(t => !t.done);
  saveTodos(todos);
  renderTodos();
}

// ========== CALENDAR FUNCTIONS ==========
function renderCalendar() {
  const data = getData('studyData', {});
  const calendarDays = document.getElementById('calendarDays');
  const monthYear = document.getElementById('calendarMonthYear');
  if (!calendarDays) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  monthYear.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;

  const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
  const lastDate = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const today = new Date();

  calendarDays.innerHTML = '';

  for (let i = 0; i < firstDay; i++) {
    calendarDays.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const div = document.createElement('div');
    div.className = 'calendar-day';

    if (today.getFullYear() === currentCalendarYear && today.getMonth() === currentCalendarMonth && today.getDate() === day) {
      div.classList.add('today');
    }

    const dayNum = document.createElement('span');
    dayNum.textContent = day;
    div.appendChild(dayNum);

    if (data[dateStr]) {
      div.classList.add('has-data');
      const mins = document.createElement('div');
      mins.className = 'study-minutes';
      mins.textContent = data[dateStr] >= 60 ? `${Math.floor(data[dateStr]/60)}h` : `${data[dateStr]}m`;
      div.appendChild(mins);
    }

    div.onclick = () => showDateDetails(dateStr, day);
    calendarDays.appendChild(div);
  }

  // Streak
  let streak = 0;
  let check = new Date();
  while (true) {
    const ds = check.toISOString().split('T')[0];
    if ((data[ds] || 0) >= 15) { streak++; check.setDate(check.getDate()-1); }
    else break;
  }
  const streakEl = document.getElementById('streak');
  if (streakEl) streakEl.innerHTML = `<i class="fas fa-fire"></i> Current Streak: ${streak} day${streak !== 1 ? 's' : ''}`;
}

function changeCalendarMonth(delta) {
  currentCalendarMonth += delta;
  if (currentCalendarMonth < 0) { currentCalendarMonth = 11; currentCalendarYear--; }
  else if (currentCalendarMonth > 11) { currentCalendarMonth = 0; currentCalendarYear++; }
  renderCalendar();
  document.getElementById('dateDetails').classList.add('hidden');
}

function showDateDetails(dateStr, day) {
  const data = getData('studyData', {});
  const minutes = data[dateStr] || 0;
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  document.getElementById('selectedDateTitle').textContent = `${monthNames[currentCalendarMonth]} ${day}, ${currentCalendarYear}`;

  if (minutes > 0) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    document.getElementById('selectedDateStudyTime').innerHTML = `<i class="fas fa-clock"></i> Study Time: <strong>${h > 0 ? `${h}h ` : ''}${m}m</strong>`;
    document.getElementById('selectedDateXP').innerHTML = `<i class="fas fa-star"></i> XP Earned: <strong>${calculateXP(minutes)}</strong>`;
  } else {
    document.getElementById('selectedDateStudyTime').textContent = 'No study recorded';
    document.getElementById('selectedDateXP').textContent = '';
  }

  document.getElementById('dateDetails').classList.remove('hidden');
}

// ========== STATS FUNCTIONS ==========
function renderStats() {
  const studyData = getData('studyData', {});
  const sessions = getData('studySessions', []);
  const userData = getData('userData', { xp: 0 });

  let totalMinutes = 0, studyDays = 0, weekMinutes = 0, monthMinutes = 0;
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7*24*60*60*1000);

  for (const [dateStr, mins] of Object.entries(studyData)) {
    totalMinutes += mins;
    studyDays++;
    const d = new Date(dateStr);
    if (d >= oneWeekAgo) weekMinutes += mins;
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) monthMinutes += mins;
  }

  document.getElementById('totalStudyTime').textContent = `${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m`;
  document.getElementById('totalXP').textContent = userData.xp || 0;
  document.getElementById('studyDays').textContent = studyDays;
  document.getElementById('currentLevelStat').textContent = getUserLevel().level;

  document.getElementById('weekly').innerHTML = `<p><i class="fas fa-calendar-week"></i> Last 7 days: <strong>${Math.floor(weekMinutes/60)}h ${weekMinutes%60}m</strong></p>`;
  document.getElementById('monthly').innerHTML = `<p><i class="fas fa-calendar-alt"></i> This month: <strong>${Math.floor(monthMinutes/60)}h ${monthMinutes%60}m</strong></p>`;

  const recent = sessions.slice(-5).reverse();
  document.getElementById('weeklyStats').innerHTML = recent.length ? recent.map(s => {
    const h = Math.floor(s.duration/60), m = s.duration%60;
    return `<div class="session-item"><i class="fas fa-calendar-day"></i> ${s.date}: ${h>0?`${h}h `:''}${m}m <span class="xp-badge">+${s.xp} XP</span></div>`;
  }).join('') : '<p style="color:rgba(255,255,255,0.5)">No sessions yet</p>';

  const xpHist = getData('xpHistory', []).slice(-10).reverse();
  document.getElementById('xpHistory').innerHTML = xpHist.length ? xpHist.map(r =>
    `<div class="xp-history-item"><i class="fas fa-star"></i> ${r.date}: +${r.xp} XP</div>`
  ).join('') : '<p style="color:rgba(255,255,255,0.5)">No XP history yet</p>';
}

// ========== AUTH ==========
function login() {
  const name = document.getElementById('usernameInput').value.trim();
  if (!name) { showInputError(); return; }
  localStorage.setItem('username', name);
  initApp();
}

function showInputError() {
  const input = document.getElementById('usernameInput');
  input.style.borderColor = '#ff4757';
  input.placeholder = 'Please enter your name!';
  setTimeout(() => {
    input.style.borderColor = '';
    input.placeholder = 'Enter your name';
  }, 1500);
}

function logout() {
  if (!confirm('Log out? Your data will be saved.')) return;

  // Stop timer if running
  if (timerIsRunning && !isPaused) pauseTimer();
  resetTimer();

  // Stop music
  stopMusic();

  // Hide music player
  document.getElementById('musicPlayer').classList.add('hidden');

  // Go back to login screen
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('statsPage').classList.add('hidden');
  document.getElementById('calendarPage').classList.add('hidden');
  document.getElementById('rankPage').classList.add('hidden');
  document.getElementById('todoPage').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');

  // Clear username
  localStorage.removeItem('username');
  document.getElementById('usernameInput').value = '';
}

function initApp() {
  const name = getUser();
  if (!name) return;

  // Init default data for this user if not exists
  if (!getData('userData', null)) setData('userData', { xp: 0 });
  if (!getData('studyData', null)) setData('studyData', {});
  if (!getData('studySessions', null)) setData('studySessions', []);
  if (!getData('xpHistory', null)) setData('xpHistory', []);
  if (!getData('todos', null)) setData('todos', []);

  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  const userLabel = document.getElementById('userLabel');
  const displayName = name.length > 10 ? name.substring(0, 10) + '…' : name;
  userLabel.innerHTML = `<i class="fas fa-user"></i> ${displayName}`;

  updateXPDisplay();
  selectTrack(1, document.querySelector('.track-btn'));
}

// ========== PAGE NAVIGATION ==========
function openTodo() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('todoPage').classList.remove('hidden');
  const d = new Date();
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('todoDateLabel').textContent = d.toLocaleDateString('en-IN', opts);
  renderTodos();
}

function closeTodo() {
  document.getElementById('todoPage').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

function openCalendar() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('calendarPage').classList.remove('hidden');
  renderCalendar();
}

function closeCalendar() {
  document.getElementById('calendarPage').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

function openStats() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('statsPage').classList.remove('hidden');
  renderStats();
}

function closeStats() {
  document.getElementById('statsPage').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

function openRank() {
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('rankPage').classList.remove('hidden');
  updateXPDisplay();
}

function closeRank() {
  document.getElementById('rankPage').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

// ========== UI HELPERS ==========
function toggleBreak() {
  document.getElementById('breakOptions').classList.toggle('hidden');
  document.getElementById('bgOptions').classList.add('hidden');
}

function toggleBg() {
  document.getElementById('bgOptions').classList.toggle('hidden');
  document.getElementById('breakOptions').classList.add('hidden');
}

function changeBg(v) {
  document.body.style.background = v === 1 ? 'var(--bg1)' : v === 2 ? 'var(--bg2)' : 'var(--bg3)';
}

// ========== INIT ==========
window.onload = function () {
  // Add dynamic styles
  const style = document.createElement('style');
  style.textContent = `
    .session-item, .xp-history-item {
      padding: 10px 14px; margin: 7px 0;
      background: rgba(255,255,255,0.05); border-radius: 10px;
      display: flex; align-items: center; gap: 10px;
      transition: all 0.25s ease; font-size: 13px; font-weight: 700;
    }
    .session-item:hover, .xp-history-item:hover { background: rgba(255,255,255,0.1); }
    .xp-badge {
      background: linear-gradient(45deg, #ff7ad9, #ff5ccd);
      padding: 3px 10px; border-radius: 10px;
      font-size: 12px; font-weight: 800; margin-left: auto;
    }
  `;
  document.head.appendChild(style);

  // Auto-login if username stored
  if (getUser()) {
    initApp();
  }

  // Fix display for visibility changes (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timerIsRunning && !isPaused) {
      lastTickTime = Date.now(); // reset tick to avoid big jump
    }
  });

  // Save on close
  window.addEventListener('beforeunload', () => {
    if (timerIsRunning && !isPaused) pauseTimer();
  });
};