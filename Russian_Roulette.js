let bulletPosition;
let cylinderPosition;
const totalChambers = 6;
let soundEnabled = true;

const home = document.getElementById('home');
const game = document.getElementById('game');
const gameover = document.getElementById('gameover');
const settings = document.getElementById('settings');
const backBtn = document.getElementById('backBtn');
const pistol = document.getElementById('pistol');
const flash = document.getElementById('flash');
const bulletCounter = document.getElementById('bulletCounter');

const gunshotSound = document.getElementById('gunshot');
const dryfireSound = document.getElementById('dryfire');

// Settings toggles
const soundToggle = document.getElementById('soundToggle');
const modeToggle = document.getElementById('modeToggle');

soundToggle.addEventListener('change', () => {
  soundEnabled = soundToggle.checked;
});

modeToggle.addEventListener('change', () => {
  document.body.classList.toggle('light-mode');
});

function startGame() {
  home.style.display = 'none';
  game.style.display = 'flex';
  loadBullet();
  updateBulletCounter();
}

function loadBullet() {
  bulletPosition = Math.floor(Math.random() * totalChambers) + 1;
  cylinderPosition = 1;
}

game.addEventListener('click', () => {
  pistol.classList.add('fire');
  setTimeout(() => pistol.classList.remove('fire'), 100);

  if (cylinderPosition === bulletPosition) {
    fireBullet();
  } else {
    dryFire();
  }
  updateBulletCounter();
});

function fireBullet() {
  flash.style.opacity = 1;
  setTimeout(() => flash.style.opacity = 0, 100);

  if (soundEnabled) {
    gunshotSound.currentTime = 0;
    gunshotSound.play();
  }

  game.style.transform = 'translateX(-5px)';
  setTimeout(() => game.style.transform = 'translateX(0px)', 100);

  setTimeout(() => {
    game.style.display = 'none';
    gameover.style.display = 'flex';
  }, 200);
}

function dryFire() {
  if (soundEnabled) {
    dryfireSound.currentTime = 0;
    dryfireSound.play();
  }

  cylinderPosition++;
  if (cylinderPosition > totalChambers) cylinderPosition = 1;
}

function restartGame() {
  gameover.style.display = 'none';
  game.style.display = 'flex';
  loadBullet();
  updateBulletCounter();
}

function updateBulletCounter() {
  const bulletsLeft = totalChambers - cylinderPosition + 1;
  bulletCounter.textContent = `Bullets: ${bulletsLeft}/${totalChambers}`;
}

// Settings Panel
function toggleSettings() { settings.style.display = 'flex'; }
function closeSettings() { settings.style.display = 'none'; }

backBtn.addEventListener('click', (e) => {
  e.stopPropagation(); // stop gun firing
  game.style.display = 'none';
  gameover.style.display = 'none';
  settings.style.display = 'none';
  home.style.display = 'flex';
});
