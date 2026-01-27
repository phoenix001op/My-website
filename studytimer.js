// ========== GLOBAL VARIABLES ==========
let interval = null;
let totalCs = 0;
let remainingTime = 0;
let studyStart = null;
let totalStudySeconds = 0; // Track total seconds studied
let lastUpdateTime = Date.now();
let isPaused = true;
let currentCalendarMonth = new Date().getMonth();
let currentCalendarYear = new Date().getFullYear();
let currentMusicTrack = 1;
let audioPlayer = new Audio();

// Level system
const LEVELS = [
  { name: "Beginner", minXP: 0, maxXP: 50 },
  { name: "Learner", minXP: 51, maxXP: 150 },
  { name: "Focused", minXP: 151, maxXP: 400 },
  { name: "Elite", minXP: 401, maxXP: 750 },
  { name: "Master", minXP: 751, maxXP: 1000 }
];

// Music tracks
const MUSIC_TRACKS = [
  "drifting-away-full-version-binaural-beats-409329.mp3",
  "https://cdn.pixabay.com/download/audio/2022/03/10/audio_4b8a1d9a4d.mp3?filename=relaxing-piano-111573.mp3",
  "https://cdn.pixabay.com/download/audio/2022/03/19/audio_1e5b5d9a4d.mp3?filename=nature-sounds-112364.mp3",
  "https://cdn.pixabay.com/download/audio/2022/03/07/audio_8b8a1d9a4d.mp3?filename=ambient-study-111208.mp3"
];

// ========== MUSIC FUNCTIONS ==========
function toggleMusicPlayer() {
  const player = document.getElementById('musicPlayer');
  player.classList.toggle('hidden');
}

function playMusic() {
  audioPlayer.play();
}

function pauseMusic() {
  audioPlayer.pause();
}

function stopMusic() {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
}

function selectTrack(track) {
  currentMusicTrack = track;
  
  // Update active button
  document.querySelectorAll('.track-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Set music source
  audioPlayer.src = MUSIC_TRACKS[track - 1];
  audioPlayer.loop = true;
  
  // Continue playing if already playing
  if (!audioPlayer.paused) {
    audioPlayer.play();
  }
}

// ========== XP & LEVEL SYSTEM ==========
function calculateXP(minutes) {
  // Calculate XP based on your requirements
  if (minutes >= 60) {
    // 50 XP for first hour + 25 XP for each additional 30 minutes
    const additionalHalfHours = Math.floor((minutes - 60) / 30);
    return 50 + (additionalHalfHours * 25);
  } else if (minutes >= 30) {
    // 25 XP for 30 minutes
    return 25;
  } else if (minutes >= 15) {
    return 10;
  } else if (minutes >= 5) {
    return 5;
  } else {
    return 1; // Minimum 1 XP
  }
}

function getUserXP() {
  const data = JSON.parse(localStorage.getItem('userData') || '{}');
  return data.xp || 0;
}

function getUserLevel() {
  const xp = getUserXP();
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].minXP && xp <= LEVELS[i].maxXP) {
      return {
        level: i + 1,
        rank: LEVELS[i].name,
        currentXP: xp,
        nextLevelXP: LEVELS[i].maxXP,
        xpNeeded: LEVELS[i].maxXP - xp + 1
      };
    }
  }
  return {
    level: 5,
    rank: "Master",
    currentXP: xp,
    nextLevelXP: 1000,
    xpNeeded: 0
  };
}

function addXP(xpToAdd) {
  const data = JSON.parse(localStorage.getItem('userData') || '{}');
  const currentXP = data.xp || 0;
  const newXP = currentXP + xpToAdd;
  
  // Save XP
  data.xp = newXP;
  localStorage.setItem('userData', JSON.stringify(data));
  
  // Save XP history
  const xpHistory = JSON.parse(localStorage.getItem('xpHistory') || '[]');
  xpHistory.push({
    date: new Date().toISOString().split('T')[0],
    xp: xpToAdd,
    total: newXP,
    timestamp: new Date().toISOString()
  });
  localStorage.setItem('xpHistory', JSON.stringify(xpHistory));
  
  // Update display
  updateXPDisplay();
  
  // Show XP gain animation
  const xpElement = document.getElementById('currentXP');
  xpElement.classList.add('xp-gain');
  setTimeout(() => xpElement.classList.remove('xp-gain'), 500);
  
  return newXP;
}

function updateXPDisplay() {
  const userLevel = getUserLevel();
  
  // Update main page
  document.getElementById('currentXP').textContent = userLevel.currentXP;
  document.getElementById('currentLevel').textContent = userLevel.level;
  
  // Calculate progress percentage
  const levelXP = userLevel.currentXP - LEVELS[userLevel.level - 1].minXP;
  const levelRange = LEVELS[userLevel.level - 1].maxXP - LEVELS[userLevel.level - 1].minXP;
  const progressPercent = levelRange > 0 ? (levelXP / levelRange) * 100 : 100;
  
  // Update progress bars
  document.getElementById('xpProgressFill').style.width = `${progressPercent}%`;
  document.getElementById('levelProgressFill').style.width = `${progressPercent}%`;
  
  // Update XP to next level
  const xpToNext = LEVELS[userLevel.level - 1].maxXP - userLevel.currentXP + 1;
  document.getElementById('xpToNext').textContent = `${xpToNext} XP to next level`;
  
  // Update rank page
  document.getElementById('currentRank').textContent = userLevel.rank;
  document.getElementById('levelNumber').textContent = userLevel.level;
  document.getElementById('rankCurrentXP').textContent = userLevel.currentXP;
  document.getElementById('rankXpToNext').textContent = xpToNext;
  
  // Update active level in list
  document.querySelectorAll('.level-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.level) === userLevel.level) {
      item.classList.add('active');
    }
  });
}

// ========== TIMER FUNCTIONS ==========
function updateDisplay() {
  let s = Math.floor(totalCs / 100);
  document.getElementById('display').innerText = 
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function startTimer() {
  if (interval && !isPaused) return;
  
  if (totalCs === 0) {
    totalCs = ((+document.getElementById('setHr').value || 0) * 3600 + 
               (+document.getElementById('setMin').value || 0) * 60 + 
               (+document.getElementById('setSec').value || 0)) * 100;
    remainingTime = totalCs;
  }
  
  if (!studyStart) {
    studyStart = Date.now();
  }
  
  lastUpdateTime = Date.now();
  isPaused = false;
  
  document.getElementById('status').innerHTML = '<i class="fas fa-book"></i> Study started';
  
  if (!interval) {
    interval = setInterval(() => {
      if (!isPaused && totalCs > 0) {
        const now = Date.now();
        const elapsed = now - lastUpdateTime;
        lastUpdateTime = now;
        
        // Calculate how much time has actually passed (in centiseconds)
        const elapsedCs = Math.floor(elapsed / 10);
        
        if (elapsedCs > 0) {
          totalCs = Math.max(0, totalCs - elapsedCs);
          totalStudySeconds += elapsedCs / 100; // Track actual seconds studied
          updateDisplay();
          
          if (totalCs <= 0) {
            finishTimer();
          }
        }
      }
    }, 100);
  }
}

function finishTimer() {
  clearInterval(interval);
  interval = null;
  isPaused = true;
  document.getElementById('endSound').play();
  
  // Calculate final study time and award XP
  const totalMinutes = Math.floor(totalStudySeconds / 60);
  
  if (totalMinutes > 0) {
    const xpEarned = calculateXP(totalMinutes);
    
    // Save the study data
    const dateStr = new Date().toISOString().split('T')[0];
    const data = JSON.parse(localStorage.getItem('studyData') || '{}');
    data[dateStr] = (data[dateStr] || 0) + totalMinutes;
    localStorage.setItem('studyData', JSON.stringify(data));
    
    // Save study session
    const sessions = JSON.parse(localStorage.getItem('studySessions') || '[]');
    sessions.push({
      date: dateStr,
      duration: totalMinutes,
      xp: xpEarned,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('studySessions', JSON.stringify(sessions));
    
    // Add XP
    addXP(xpEarned);
    
    document.getElementById('status').innerHTML = `<i class="fas fa-check-circle"></i> Study completed! +${xpEarned} XP`;
    
    // Show notification
    showNotification(`🎉 Great job! You earned ${xpEarned} XP for studying ${totalMinutes} minutes!`);
    
    // Reset study tracking
    totalStudySeconds = 0;
    studyStart = null;
  } else {
    document.getElementById('status').innerHTML = '<i class="fas fa-check-circle"></i> Timer finished';
  }
}

function pauseTimer() {
  if (!interval || isPaused) return;
  
  isPaused = true;
  
  // Save current study progress
  if (studyStart && totalStudySeconds > 0) {
    const minutes = Math.floor(totalStudySeconds / 60);
    if (minutes > 0) {
      const xpEarned = calculateXP(minutes);
      
      // Save study data
      const dateStr = new Date().toISOString().split('T')[0];
      const data = JSON.parse(localStorage.getItem('studyData') || '{}');
      data[dateStr] = (data[dateStr] || 0) + minutes;
      localStorage.setItem('studyData', JSON.stringify(data));
      
      // Save session
      const sessions = JSON.parse(localStorage.getItem('studySessions') || '[]');
      sessions.push({
        date: dateStr,
        duration: minutes,
        xp: xpEarned,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('studySessions', JSON.stringify(sessions));
      
      // Add XP
      addXP(xpEarned);
      
      // Show notification
      showNotification(`⏸️ Session paused: +${xpEarned} XP for ${minutes} minutes`);
      
      // Reset tracking
      totalStudySeconds = 0;
      studyStart = Date.now(); // Reset for next segment
    }
  }
  
  document.getElementById('status').innerHTML = '<i class="fas fa-pause-circle"></i> Timer paused';
}

function resetTimer() {
  clearInterval(interval);
  interval = null;
  isPaused = true;
  totalCs = 0;
  remainingTime = 0;
  totalStudySeconds = 0;
  studyStart = null;
  updateDisplay();
  document.getElementById('status').innerHTML = '<i class="fas fa-book-open"></i> Ready to study';
}

function startBreak(minutes) {
  resetTimer();
  totalCs = minutes * 6000;
  remainingTime = totalCs;
  document.getElementById('status').innerHTML = `<i class="fas fa-coffee"></i> ${minutes} min break started`;
  startTimer();
}

// ========== NOTIFICATION ==========
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerHTML = `<i class="fas fa-bell"></i> ${message}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(45deg, #ff7ad9, #7597de);
    color: white;
    padding: 15px 25px;
    border-radius: 10px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ========== CALENDAR FUNCTIONS ==========
function renderCalendar() {
  const data = JSON.parse(localStorage.getItem('studyData') || '{}');
  const calendarDays = document.getElementById('calendarDays');
  const monthYear = document.getElementById('calendarMonthYear');
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  monthYear.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
  
  const firstDay = new Date(currentCalendarYear, currentCalendarMonth, 1);
  const lastDay = new Date(currentCalendarYear, currentCalendarMonth + 1, 0);
  const totalDays = lastDay.getDate();
  const startingDay = firstDay.getDay();
  
  calendarDays.innerHTML = '';
  
  for (let i = 0; i < startingDay; i++) {
    const emptyDiv = document.createElement('div');
    calendarDays.appendChild(emptyDiv);
  }
  
  const today = new Date();
  
  for (let day = 1; day <= totalDays; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    if (currentCalendarYear === today.getFullYear() && 
        currentCalendarMonth === today.getMonth() && 
        day === today.getDate()) {
      dayDiv.classList.add('today');
    }
    
    if (data[dateStr]) {
      dayDiv.classList.add('has-data');
      const minutesDiv = document.createElement('div');
      minutesDiv.className = 'study-minutes';
      minutesDiv.textContent = `${data[dateStr]}m`;
      dayDiv.appendChild(minutesDiv);
    }
    
    dayDiv.textContent = day;
    dayDiv.onclick = () => showDateStudyTime(dateStr, day);
    calendarDays.appendChild(dayDiv);
  }
  
  let streak = 0;
  let checkDate = new Date();
  while (data[checkDate.toISOString().split('T')[0]] >= 15) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }
  document.getElementById('streak').innerHTML = `<i class="fas fa-fire"></i> Current Streak: ${streak} day(s)`;
}

function changeCalendarMonth(change) {
  currentCalendarMonth += change;
  if (currentCalendarMonth < 0) {
    currentCalendarMonth = 11;
    currentCalendarYear--;
  } else if (currentCalendarMonth > 11) {
    currentCalendarMonth = 0;
    currentCalendarYear++;
  }
  renderCalendar();
}

function showDateStudyTime(dateStr, day) {
  const data = JSON.parse(localStorage.getItem('studyData') || '{}');
  const minutes = data[dateStr] || 0;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  
  document.getElementById('selectedDateTitle').textContent = 
    `${monthNames[currentCalendarMonth]} ${day}, ${currentCalendarYear}`;
  
  if (minutes > 0) {
    const xpEarned = calculateXP(minutes);
    document.getElementById('selectedDateStudyTime').innerHTML = 
      `<i class="fas fa-clock"></i> Study Time: <strong>${hours > 0 ? `${hours}h ` : ''}${remainingMinutes}m</strong>`;
    document.getElementById('selectedDateXP').innerHTML = 
      `<i class="fas fa-star"></i> XP Earned: <strong>${xpEarned}</strong>`;
  } else {
    document.getElementById('selectedDateStudyTime').textContent = 'No study recorded';
    document.getElementById('selectedDateXP').textContent = '';
  }
  
  document.getElementById('dateDetails').classList.remove('hidden');
}

// ========== STATS FUNCTIONS ==========
function renderStats() {
  const data = JSON.parse(localStorage.getItem('studyData') || '{}');
  const sessions = JSON.parse(localStorage.getItem('studySessions') || '[]');
  const userData = JSON.parse(localStorage.getItem('userData') || '{}');
  
  let totalMinutes = 0;
  let studyDays = 0;
  let weekMinutes = 0;
  let monthMinutes = 0;
  let totalXP = userData.xp || 0;
  
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  for (let dateStr in data) {
    const minutes = data[dateStr];
    totalMinutes += minutes;
    studyDays++;
    
    const date = new Date(dateStr);
    if (date >= oneWeekAgo) {
      weekMinutes += minutes;
    }
    if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
      monthMinutes += minutes;
    }
  }
  
  // Update stat cards
  document.getElementById('totalStudyTime').textContent = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  document.getElementById('totalXP').textContent = totalXP;
  document.getElementById('studyDays').textContent = studyDays;
  document.getElementById('currentLevelStat').textContent = getUserLevel().level;
  
  // Update stats
  document.getElementById('weekly').innerHTML = 
    `<p><i class="fas fa-calendar-week"></i> Last 7 days: ${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m</p>`;
  document.getElementById('monthly').innerHTML = 
    `<p><i class="fas fa-calendar-month"></i> This month: ${Math.floor(monthMinutes / 60)}h ${monthMinutes % 60}m</p>`;
  
  // Recent sessions
  const recentSessions = sessions.slice(-5).reverse();
  let sessionsHTML = '';
  recentSessions.forEach(session => {
    const hours = Math.floor(session.duration / 60);
    const minutes = session.duration % 60;
    sessionsHTML += `
      <div class="session-item">
        <i class="fas fa-calendar-day"></i> ${session.date}: 
        ${hours > 0 ? `${hours}h ` : ''}${minutes}m 
        <span class="xp-badge">+${session.xp} XP</span>
      </div>
    `;
  });
  document.getElementById('weeklyStats').innerHTML = sessionsHTML || '<p>No recent sessions</p>';
  
  // XP history
  const xpHistory = JSON.parse(localStorage.getItem('xpHistory') || '[]').slice(-10).reverse();
  let xpHistoryHTML = '';
  xpHistory.forEach(record => {
    xpHistoryHTML += `
      <div class="xp-history-item">
        <i class="fas fa-star"></i> ${record.date}: +${record.xp} XP
      </div>
    `;
  });
  document.getElementById('xpHistory').innerHTML = xpHistoryHTML || '<p>No XP history</p>';
}

// ========== PAGE NAVIGATION ==========
function login() {
  const name = document.getElementById('usernameInput').value.trim();
  if (!name) return alert('Please enter your name');
  localStorage.setItem('username', name);
  initApp();
}

function initApp() {
  const name = localStorage.getItem('username');
  if (!name) return;
  
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userLabel').innerHTML = `<i class="fas fa-user"></i> ${name}`;
  
  updateXPDisplay();
  selectTrack(1);
  renderCalendar();
}

// Navigation functions
function openCalendar() {
  if (interval && !isPaused) pauseTimer();
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('calendarPage').classList.remove('hidden');
  renderCalendar();
}

function closeCalendar() {
  document.getElementById('calendarPage').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

function openStats() {
  if (interval && !isPaused) pauseTimer();
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('statsPage').classList.remove('hidden');
  renderStats();
}

function closeStats() {
  document.getElementById('statsPage').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
}

function openRank() {
  if (interval && !isPaused) pauseTimer();
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
  document.body.style.background = v == 1 ? 'var(--bg1)' : v == 2 ? 'var(--bg2)' : 'var(--bg3)';
}

// ========== INITIALIZATION ==========
window.onload = function() {
  initApp();
  
  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    .session-item, .xp-history-item {
      padding: 10px 15px;
      margin: 8px 0;
      background: rgba(255,255,255,0.05);
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: all 0.3s ease;
    }
    .session-item:hover, .xp-history-item:hover {
      background: rgba(255,255,255,0.1);
    }
    .xp-badge {
      background: linear-gradient(45deg, #ff7ad9, #ff5ccd);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-left: auto;
    }
  `;
  document.head.appendChild(style);
  
  // Initialize user data
  if (!localStorage.getItem('userData')) {
    localStorage.setItem('userData', JSON.stringify({ xp: 0 }));
  }
  if (!localStorage.getItem('studyData')) {
    localStorage.setItem('studyData', JSON.stringify({}));
  }
  if (!localStorage.getItem('studySessions')) {
    localStorage.setItem('studySessions', JSON.stringify([]));
  }
  if (!localStorage.getItem('xpHistory')) {
    localStorage.setItem('xpHistory', JSON.stringify([]));
  }
  
  // Handle page visibility
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && interval && !isPaused) {
      lastUpdateTime = Date.now();
    }
  });
  
  // Auto-save on page close
  window.addEventListener('beforeunload', function() {
    if (interval && !isPaused) {
      pauseTimer();
    }
  });
};