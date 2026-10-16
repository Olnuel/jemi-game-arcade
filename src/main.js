import { IdentityDash } from './games/identity-dash.js';
import { AvatarJump } from './games/avatar-jump.js';
import { Salubata } from './games/salubata.js';
import { mapStartNgStyle, onStartNgUserChange, readStartNgIdentity, START_NG, startNgSignIn } from './identity/startng.js';
import { PREVIEW_STYLE } from './identity/player-character.js';

const games = [
  {
    id: 'identity-dash',
    title: 'Identity Dash',
    meta: 'ENDLESS RUNNER · PLAY NOW',
    description: 'Dodge the night traffic, clear road barriers, and scoop up coins on the way.',
    number: 'A',
    playable: true,
  },
  {
    id: 'avatar-jump',
    title: 'Avatar Jump',
    meta: 'PLATFORMER · PLAY NOW',
    description: 'Jump across the lantern platforms, collect the stars, and reach the rooftop finish.',
    number: 'B',
    playable: true,
  },
  {
    id: 'salubata',
    title: 'Salubata',
    meta: 'STREET GAME · PLAY NOW',
    description: 'Pass the phone, throw your slipper behind you, then slide it at the rubber bands. Most bands wins.',
    number: 'C',
    playable: true,
  },
];

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#home" aria-label="Start.ng Arcade home">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>START.NG <b>ARCADE</b></span>
      </a>
      <div class="topbar-right">
        <a class="text-link" href="https://start.ng" target="_blank" rel="noreferrer">Start.ng</a>
        <a class="identity-chip" id="identity-link" href="https://start.ng/" title="Open Start.ng">
          <span class="status-dot" id="identity-dot"></span>
          <span id="identity-label">${START_NG ? 'CHECKING START.NG' : 'VISITOR PREVIEW'}</span>
          <span class="profile-avatar" id="header-avatar" aria-hidden="true">?</span>
        </a>
      </div>
    </header>

    <main class="arcade-layout" id="home">
      <section class="feature" aria-labelledby="game-title">
        <div class="scene-wrap" id="scene-wrap">
          <canvas id="game-canvas" aria-label="Three-dimensional night street runner preview"></canvas>
          <div class="scene-vignette" aria-hidden="true"></div>
          <div class="scene-topline"><span class="live-led"></span><span id="scene-caption">LAGOS AFTER DARK</span><span class="scene-rule"></span><span class="scene-index">01 / 03</span></div>
          <div class="scene-copy" id="scene-copy">
            <div class="street-sign">NIGHT<br/>RUN</div>
            <div class="feature-text">
              <h1 id="game-title">Identity<br/><em>Dash</em></h1>
              <p id="game-description">Dodge the night traffic, clear road barriers, and scoop up coins on the way.</p>
              <button class="play-button" id="start-button" type="button">
                <span>Start running</span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6 3.8 15 10l-9 6.2z" fill="currentColor"/></svg>
              </button>
              <p class="key-hint">ARROWS TO MOVE <span>·</span> SPACE TO JUMP</p>
            </div>
          </div>
          <div class="hud" id="hud" aria-live="polite" hidden>
            <div class="hud-score"><span id="hud-score-label">DISTANCE</span><strong id="score-value">000</strong><small id="score-unit">m</small></div>
            <div class="hud-stat"><span class="coin-mark" aria-hidden="true">₦</span><span id="coin-value">0</span><small id="collectible-label">COINS</small></div>
            <div class="hud-stat life-stat"><span id="hud-life-label">RUNS</span><strong id="life-value">● ● ●</strong></div>
          <button class="pause-button" id="pause-button" type="button" aria-label="Pause run"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6.5 4.5v11M13.5 4.5v11" /></svg></button>
          </div>
          <div class="game-message" id="game-message" hidden aria-live="assertive"></div>
          <div class="touch-controls" aria-label="Touch game controls">
            <button type="button" data-action="left" aria-label="Move left">←</button>
            <button type="button" data-action="jump" aria-label="Jump">JUMP</button>
            <button type="button" data-action="right" aria-label="Move right">→</button>
          </div>
          <div class="scene-footnote"><span>THREE LANES. ONE GOOD RUN.</span><span class="footnote-coordinates">06°27′ N &nbsp; 03°24′ E</span></div>
        </div>

        <div class="feature-foot">
          <div class="feature-caption"><span class="caption-star">✳</span><span>One character, carried across every game.</span></div>
          <div class="feature-best"><span>PERSONAL BEST</span><strong id="best-value">000</strong></div>
        </div>
      </section>

      <aside class="game-shelf" aria-label="Choose a game">
        <div class="shelf-heading"><h2>Pick your game</h2><span>03 TITLES</span></div>
        <nav class="game-list" id="game-list" aria-label="Games"></nav>
        <div class="profile-panel">
          <div class="panel-heading"><span>YOUR PLAYER</span><span class="panel-lock" aria-hidden="true">◌</span></div>
          <div class="player-row">
            <div class="player-avatar" id="player-avatar" aria-hidden="true"><span></span></div>
            <div><strong id="player-name">Visitor</strong><span class="profile-state" id="profile-state">Style preview</span></div>
            <span class="palette-swatch" id="palette-swatch" aria-hidden="true"></span>
          </div>
          <p class="profile-note" id="profile-note">${START_NG ? 'Checking your centrally managed Start.ng character…' : 'Your Start.ng character styling appears when the game is hosted on your Start.ng address.'}</p>
        </div>
        <div class="controls-note"><span class="keyboard-icon" aria-hidden="true">⌘</span><p>Use the arrow keys and spacebar, or swipe across the road.</p></div>
        <footer class="shelf-footer"><span>MADE FOR THE PLAYERS</span><span>NG · 001</span></footer>
      </aside>
    </main>
    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>
`;

const gameList = document.querySelector('#game-list');
const title = document.querySelector('#game-title');
const description = document.querySelector('#game-description');
const startButton = document.querySelector('#start-button');
const sceneCopy = document.querySelector('#scene-copy');
const hud = document.querySelector('#hud');
const message = document.querySelector('#game-message');
const pauseButton = document.querySelector('#pause-button');
const toast = document.querySelector('#toast');
const canvas = document.querySelector('#game-canvas');
const sceneWrap = document.querySelector('#scene-wrap');
let activeGame = games[0];
let controller;
let toastTimer;
let frameState = 'menu';
let currentUser = null;
let currentStyle = PREVIEW_STYLE;

function applyIdentity(user) {
  currentUser = user;
  currentStyle = user ? mapStartNgStyle(user) : PREVIEW_STYLE;
  controller?.setStyle(currentStyle);

  const name = currentStyle.name;
  const profileName = document.querySelector('#player-name');
  const profileState = document.querySelector('#profile-state');
  const profileNote = document.querySelector('#profile-note');
  const identityLink = document.querySelector('#identity-link');
  const identityLabel = document.querySelector('#identity-label');
  const identityDot = document.querySelector('#identity-dot');
  const headerAvatar = document.querySelector('#header-avatar');
  const panel = document.querySelector('.profile-panel');

  profileName.textContent = name;
  profileState.textContent = user ? 'Start.ng profile · synced' : START_NG ? 'Guest player' : 'Style preview';
  profileNote.textContent = user
    ? `Your saved Start.ng character is active in ${activeGame.title}.`
    : START_NG
      ? 'Sign in with Start.ng to bring your saved character into the run.'
      : 'Your Start.ng character appears here when this game is hosted on its Start.ng address.';
  identityLabel.textContent = user ? `${name.toUpperCase()} · START.NG` : START_NG ? 'SIGN IN WITH START.NG' : 'VISITOR PREVIEW';
  identityDot.classList.toggle('is-connected', Boolean(user));
  identityDot.classList.toggle('is-checking', !user && START_NG);
  headerAvatar.textContent = name.slice(0, 1).toUpperCase();
  identityLink.title = user ? 'Signed in with Start.ng' : 'Sign in with Start.ng to use your profile';
  panel.style.setProperty('--character-skin', currentStyle.skinColor);
  panel.style.setProperty('--character-hair', currentStyle.hairColor);
  panel.style.setProperty('--character-top', currentStyle.primaryColor);
  panel.style.setProperty('--character-bottoms', currentStyle.secondaryColor);
}

function handleIdentityLink(event) {
  if (!START_NG || currentUser) return;
  event.preventDefault();
  startNgSignIn();
}

function renderShelf() {
  gameList.innerHTML = games.map((game) => `
    <button class="game-row ${game === activeGame ? 'is-selected' : ''} ${game.playable ? '' : 'is-unavailable'}" type="button" data-game="${game.id}">
      <span class="game-letter">${game.number}</span>
      <span class="game-row-text"><strong>${game.title}</strong><small>${game.meta}</small></span>
      <span class="game-row-arrow" aria-hidden="true">${game.playable ? '↗' : '· · ·'}</span>
    </button>
  `).join('');
  gameList.querySelectorAll('.game-row').forEach((button) => {
    button.addEventListener('click', () => selectGame(button.dataset.game));
  });
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function selectGame(id) {
  const game = games.find((item) => item.id === id);
  if (!game) return;
  if (controller && frameState !== 'menu') {
    showToast('Finish or return from the current run before switching games.');
    return;
  }
  controller?.dispose();
  activeGame = game;
  const words = game.title.split(' ');
  const firstWord = words.shift();
  title.innerHTML = words.length ? `${firstWord}<br/><em>${words.join(' ')}</em>` : `<em>${firstWord}</em>`;
  description.textContent = game.description;
  document.querySelector('#start-button span').textContent = game.id === 'identity-dash' ? 'Start running' : game.id === 'avatar-jump' ? 'Start climbing' : 'Pass the phone';
  document.querySelector('.key-hint').textContent = game.id === 'identity-dash'
    ? 'ARROWS TO MOVE · SPACE TO JUMP'
    : game.id === 'avatar-jump'
      ? 'LEFT / RIGHT TO MOVE · SPACE TO JUMP'
      : 'HOLD ↓ TO THROW BACK · ← / → TO AIM · SPACE TO SLIDE';
  document.querySelector('.controls-note p').textContent = game.id === 'identity-dash'
    ? 'Use the arrow keys and spacebar, or swipe across the road.'
    : game.id === 'avatar-jump'
      ? 'Use left and right to steer, then jump between the floating platforms.'
      : 'Set your back throw, then aim and charge the slipper slide.';
  const touchButtons = [...document.querySelectorAll('.touch-controls button')];
  touchButtons[1].textContent = game.id === 'salubata' ? 'THROW' : 'JUMP';
  touchButtons[1].dataset.action = game.id === 'salubata' ? 'throw' : 'jump';
  document.querySelector('#scene-caption').textContent = game.id === 'identity-dash' ? 'LAGOS AFTER DARK' : game.id === 'avatar-jump' ? 'UP ABOVE THE MARKET' : 'SALUBATA STREET';
  createController();
  renderShelf();
  // Selecting a title should launch it immediately in the full-viewport game view.
  startRun();
}

function createController() {
  const Game = { 'identity-dash': IdentityDash, 'avatar-jump': AvatarJump, salubata: Salubata }[activeGame.id];
  controller = new Game(canvas, { style: currentStyle, onChange: updateRunUI });
}

function updateRunUI(state) {
  frameState = state.state;
  sceneWrap.classList.toggle('is-playing', state.state !== 'menu');
  sceneWrap.classList.toggle('is-running', state.state === 'running');
  document.body.classList.toggle('game-fullscreen', state.state !== 'menu');
  const isSalubata = activeGame.id === 'salubata';
  document.querySelector('#hud-score-label').textContent = activeGame.id === 'avatar-jump' ? 'CLIMB SCORE' : isSalubata ? 'POINTS' : 'DISTANCE';
  document.querySelector('#score-unit').textContent = activeGame.id === 'avatar-jump' ? 'pts' : isSalubata ? 'pts' : 'm';
  document.querySelector('#collectible-label').textContent = activeGame.id === 'avatar-jump' ? 'STARS' : isSalubata ? 'BANDS' : 'COINS';
  document.querySelector('#coin-value').textContent = state.coins;
  document.querySelector('#score-value').textContent = String(state.score).padStart(3, '0');
  document.querySelector('#best-value').textContent = String(state.best).padStart(3, '0');
  document.querySelector('#hud-life-label').textContent = isSalubata ? 'ROUND · PLAYER' : activeGame.id === 'avatar-jump' ? 'LEVEL' : 'RUNS';
  document.querySelector('#life-value').textContent = isSalubata ? `R${state.round || 1} · P${state.turn || 1}` : activeGame.id === 'avatar-jump' ? `${Math.min(7, (state.level || 1))}/7` : `${'● '.repeat(state.lives).trim()}${state.lives ? ' ' : ''}${'○ '.repeat(3 - state.lives).trim()}`;
  document.querySelector('.coin-mark').textContent = isSalubata ? '◎' : '₦';
  hud.hidden = state.state === 'menu';
  sceneCopy.hidden = state.state !== 'menu';
  pauseButton.hidden = !['running', 'paused'].includes(state.state);
  pauseButton.setAttribute('aria-label', state.state === 'paused' ? 'Resume run' : 'Pause run');
  pauseButton.classList.toggle('is-resume', state.state === 'paused');
  pauseButton.innerHTML = state.state === 'paused'
    ? '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4.5 8 5.5-8 5.5z" /></svg>'
    : '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6.5 4.5v11M13.5 4.5v11" /></svg>';

  const labels = {
    paused: '<strong>Take a breather.</strong><span>Your game is paused.</span><button type="button" data-action="resume">Resume game</button><button type="button" class="message-secondary" data-action="home">Back to games</button>',
    over: `<strong>${state.resultTitle || 'Good game.'}</strong><span>${state.resultBody || `${state.score} metres · ${state.coins} coins`}</span><button type="button" data-action="restart">${state.resultAction || 'Play again'}</button><button type="button" class="message-secondary" data-action="home">Back to games</button>`,
    won: `<strong>${state.resultTitle || 'You made it.'}</strong><span>${state.resultBody || `${state.score} points`}</span><button type="button" data-action="restart">${state.resultAction || 'Play again'}</button><button type="button" class="message-secondary" data-action="home">Back to games</button>`,
  };
  if (labels[state.state]) {
    message.innerHTML = labels[state.state];
    message.hidden = false;
    message.querySelector('[data-action="resume"]')?.addEventListener('click', () => controller.resume());
    message.querySelector('[data-action="restart"]')?.addEventListener('click', () => controller.start());
    message.querySelector('[data-action="home"]')?.addEventListener('click', returnHome);
  } else {
    message.hidden = true;
    message.innerHTML = '';
  }
  document.querySelector('#scene-caption').textContent = state.state === 'running' ? (activeGame.id === 'salubata' ? state.phaseLabel : activeGame.id === 'avatar-jump' ? 'CLIMB IN PROGRESS' : 'RUN IN PROGRESS') : activeGame.id === 'identity-dash' ? 'LAGOS AFTER DARK' : activeGame.id === 'avatar-jump' ? 'UP ABOVE THE MARKET' : 'SALUBATA STREET';
  if (state.phaseText) document.querySelector('.scene-footnote span:first-child').textContent = state.phaseText.toUpperCase();
  else document.querySelector('.scene-footnote span:first-child').textContent = activeGame.id === 'avatar-jump' ? `${state.level || 1} OF 7 PLATFORMS` : 'THREE LANES. ONE GOOD RUN.';
  if (state.turn && !isSalubata) document.querySelector('#hud-life-label').textContent = `TURN ${state.turn}/${state.maxTurns}`;
}

function startRun() {
  try {
    controller.start();
  } catch (error) {
    showToast('This browser could not start the 3D game. Try a browser with WebGL enabled.');
    console.error(error);
  }
}

function returnHome() {
  if (controller) controller.state = 'menu';
  updateRunUI({ state: 'menu', score: 0, coins: 0, best: controller?.best || 0, lives: 3 });
}

startButton.addEventListener('click', startRun);
pauseButton.addEventListener('click', () => {
  if (controller.state === 'paused') controller.resume();
  else controller.pause();
});
document.querySelectorAll('.touch-controls button').forEach((button) => {
  if (button.dataset.action === 'jump') {
    button.addEventListener('pointerdown', (event) => {
      if (activeGame.id === 'salubata') controller?.beginCharge(event.timeStamp);
    });
    button.addEventListener('pointerup', (event) => {
      if (activeGame.id === 'salubata') controller?.releaseCharge(event.timeStamp);
    });
    button.addEventListener('pointercancel', (event) => {
      if (activeGame.id === 'salubata') controller?.releaseCharge(event.timeStamp);
    });
  }
  button.addEventListener('click', () => {
    if (!controller) return;
    if (button.dataset.action === 'jump') controller.jump();
    else if (button.dataset.action === 'throw') controller.throwAction();
    else controller.move(button.dataset.action === 'left' ? -1 : 1);
  });
});
renderShelf();
document.querySelector('#identity-link').addEventListener('click', handleIdentityLink);
document.querySelector('#best-value').textContent = String(Number(localStorage.getItem('arcade:identity-dash:best') || 0)).padStart(3, '0');
try {
  createController();
} catch (error) {
  sceneWrap.classList.add('no-webgl');
  showToast('This browser could not start the 3D street. Try a browser with WebGL enabled.');
  console.error(error);
}

readStartNgIdentity().then((identity) => {
  applyIdentity(identity.user);
  if (identity.status === 'unavailable' && START_NG) {
    document.querySelector('#profile-note').textContent = 'Start.ng sign-in could not be checked. Reload this game to try again.';
  }
}).catch((error) => {
  console.warn('Start.ng sign-in check failed.', error);
});
onStartNgUserChange(applyIdentity);

window.addEventListener('pagehide', () => controller?.dispose(), { once: true });
