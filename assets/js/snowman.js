// Snowman that glides around the four corners of the screen.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .snowman {
      --size: clamp(48px, 9vw, 76px);
      --gap: 8px;
      --right: calc(100vw - var(--size) - var(--gap) - 12px);
      --bottom: calc(100vh - var(--size) * 1.25 - var(--gap));
      position: fixed; top: 0; left: 0; width: var(--size);
      z-index: 9999; pointer-events: none;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,.45));
      animation: snowman-path 32s linear infinite;
    }
    @supports (height: 100dvh) { .snowman { --bottom: calc(100dvh - var(--size) * 1.25 - var(--gap)); } }
    .snowman-face { animation: snowman-turn 32s step-end infinite; }
    .snowman svg { display: block; width: 100%; overflow: visible; animation: snowman-hop .7s ease-in-out infinite; transform-origin: 50% 94%; }
    .snowman .wave { transform-origin: 73px 76px; animation: snowman-wave .6s ease-in-out infinite alternate; }
    .snowman .swing { transform-origin: 27px 76px; animation: snowman-wave 1.1s ease-in-out infinite alternate-reverse; }
    .snowman .eye { transform-box: fill-box; transform-origin: center; animation: snowman-blink 3s infinite; }
    .snowman .scarf { transform-origin: 56px 72px; animation: snowman-flap .45s ease-in-out infinite alternate; }
    .snowman .hat { transform-origin: 50px 31px; animation: snowman-hat 2.8s ease-in-out infinite; }
    .snowman .flake { fill: #fff; opacity: 0; animation: snowman-flake 1.8s linear infinite; }
    @keyframes snowman-path {
      0%, 100% { transform: translate(var(--gap), var(--bottom)); }
      25% { transform: translate(var(--right), var(--bottom)); }
      50% { transform: translate(var(--right), var(--gap)); }
      75% { transform: translate(var(--gap), var(--gap)); }
    }
    @keyframes snowman-turn { 0% { transform: scaleX(1); } 50%, 100% { transform: scaleX(-1); } }
    @keyframes snowman-hop {
      0%, 100% { transform: translateY(0) rotate(-6deg) scale(1.06, .93); }
      50% { transform: translateY(-13%) rotate(6deg) scale(.96, 1.05); }
    }
    @keyframes snowman-wave { from { transform: rotate(-24deg); } to { transform: rotate(20deg); } }
    @keyframes snowman-blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes snowman-flap { from { transform: rotate(-8deg); } to { transform: rotate(18deg) skewX(-8deg); } }
    @keyframes snowman-hat { 0%, 65%, 100% { transform: translateY(0) rotate(0); } 78% { transform: translateY(-9px) rotate(-14deg); } }
    @keyframes snowman-flake { 0% { opacity: 0; transform: translateY(-8px); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(-10px, 34px); } }`;
  const box = document.createElement('div');
  box.className = 'snowman';
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `<div class="snowman-face"><svg viewBox="0 0 100 125">
    <g stroke="#8a5a34" stroke-width="4" stroke-linecap="round"><path class="swing" d="M27 76L6 59M12 64L5 68"/><path class="wave" d="M73 76L94 59M88 64L95 68"/></g>
    <circle cx="50" cy="92" r="29" fill="#f7fbff" stroke="#b9d6ec" stroke-width="2"/>
    <circle cx="50" cy="49" r="22" fill="#f7fbff" stroke="#b9d6ec" stroke-width="2"/>
    <g class="hat"><rect x="34" y="7" width="32" height="23" rx="2" fill="#243447"/><rect x="34" y="22" width="32" height="6" fill="#d63e4b"/><rect x="25" y="28" width="50" height="6" rx="3" fill="#243447"/></g>
    <circle class="eye" cx="42" cy="45" r="3" fill="#1c2733"/><circle class="eye" cx="58" cy="45" r="3" fill="#1c2733"/>
    <path d="M49 51L72 56L49 58Z" fill="#f28c28"/>
    <path d="M32 65Q50 75 68 65L66 73Q50 82 34 73Z" fill="#d63e4b"/><path class="scarf" d="M59 73L70 94L61 97L53 76Z" fill="#d63e4b"/>
    <circle cx="46" cy="87" r="3" fill="#1c2733"/><circle cx="46" cy="99" r="3" fill="#1c2733"/>
    <circle class="flake" cx="8" cy="30" r="3"/><circle class="flake" cx="94" cy="20" r="2.5" style="animation-delay:.6s"/><circle class="flake" cx="12" cy="90" r="2" style="animation-delay:1.2s"/>
  </svg></div>`;
  document.head.append(style);
  document.body.append(box);
})();
