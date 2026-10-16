import { sound } from './audio/sound.js';
import { IdentityDash } from './games/identity-dash.js';
import { AvatarJump } from './games/avatar-jump.js';
import { Salubata } from './games/salubata.js';
import { mapStartNgStyle, onStartNgUserChange, readStartNgIdentity, saveStartNgScore, readStartNgLeaderboard, START_NG, startNgSignIn } from './identity/startng.js';
import { PREVIEW_STYLE, bodyOptions, readBodyOverride, writeBodyOverride } from './identity/player-character.js';
import { lightPresets, readLighting, writeLighting } from './scene/sky.js';

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
    description: 'Throw your slipper behind you to set the mark, then slide it through the rubber bands.',
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
          <div class="hud-actions">
            <button class="sound-button" id="sound-button" type="button" aria-label="Toggle sound">
              <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M9.5 4.5 5 8H2v4h3l4.5 3.5V4.5zM14 7a4.5 4.5 0 0 1 0 6M16 4.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="pause-button" id="pause-button" type="button" aria-label="Pause run"><svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6.5 4.5v11M13.5 4.5v11" /></svg></button>
          </div>
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
        <div class="body-panel">
          <div class="panel-heading"><span>CHARACTER BODY</span><span id="body-hint">Your Start.ng look</span></div>
          <div class="body-options" id="body-options" role="group" aria-label="Character body"></div>
        </div>
        <div class="lighting-panel">
          <div class="panel-heading"><span>TIME OF DAY</span><span id="lighting-hint">Lagos dusk</span></div>
          <div class="lighting-options" id="lighting-options" role="group" aria-label="Time of day"></div>
        </div>
        <div class="controls-note"><span class="keyboard-icon" aria-hidden="true">⌘</span><p>Use the arrow keys and spacebar, or swipe across the road.</p></div>
        <div class="leaderboard-panel" id="leaderboard-panel" hidden>
          <div class="panel-heading"><span>START.NG TOP RUNS</span><span aria-hidden="true">★</span></div>
          <ol class="leaderboard-list" id="leaderboard-list"></ol>
        </div>
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
let lastPauseState = null;
let scoreSent = false;
let playerSignedIn = false;
let platformStyle = PREVIEW_STYLE;
let bodyOverride = readBodyOverride();

// The player's own body choice wins over the account's, so they can play as they
// like without changing the rest of the colours Start.ng manages for them.
function resolveStyle() {
  const base = platformStyle || PREVIEW_STYLE;
  return bodyOverride ? { ...base, body: bodyOverride } : base;
}

function setBody(id) {
  bodyOverride = id;
  writeBodyOverride(id);
  currentStyle = resolveStyle();
  controller?.setStyle(currentStyle);
  renderBodyOptions(id);
  document.querySelector('.profile-panel')?.setAttribute('data-body', currentStyle.body);
}

function renderBodyOptions(selected = bodyOverride) {
  const host = document.querySelector('#body-options');
  if (!host) return;
  host.innerHTML = bodyOptions()
    .map((option) => `<button type="button" class="body-option" data-body="${option.id}" aria-pressed="${option.id === selected}">${option.label}</button>`)
    .join('');
  document.querySelector('#body-hint').textContent = selected
    ? 'Your choice, remembered here'
    : 'Following your Start.ng look';
}

// Pushes a finished run to the shared start.ng leaderboard. Only signed-in players
// can save; guests and local previews quietly skip it.
async function publishRunScore(state) {
  if (scoreSent || !START_NG) return;
  scoreSent = true;
  try {
    const result = await saveStartNgScore({
      score: state.score || 0,
      stars: state.coins || 0,
      coins: state.coins || 0,
    });
    if (result?.result) {
      const rank = result.result.rank;
      showToast(result.result.improved && rank ? `New personal best on Start.ng - you are #${rank}!` : 'Run saved to your Start.ng leaderboard.');
    }
  } catch {
    // A failed score save must never interrupt play.
  }
  refreshLeaderboard();
}

async function refreshLeaderboard() {
  const panel = document.querySelector('#leaderboard-panel');
  const board = document.querySelector('#leaderboard-list');
  if (!board) return;
  // The panel is always visible so the board is discoverable; off-platform it
  // explains itself rather than showing an empty list.
  panel.hidden = false;
  if (!START_NG) {
    board.innerHTML = '<li class="leaderboard-empty">Live on your Start.ng address. Signed-in players score here.</li>';
    return;
  }
  try {
    const entries = await readStartNgLeaderboard(5);
    if (!entries.length) {
      board.innerHTML = '<li class="leaderboard-empty">No runs saved yet. Sign in and be the first.</li>';
      return;
    }
    board.innerHTML = entries
      .map((entry) => `<li${entry.player_id && currentUser && entry.player_id === currentUser.id ? ' class="is-you"' : ''}><span>${entry.rank}</span><b>${entry.name}</b><i>${entry.stats?.score ?? entry.score}</i></li>`)
      .join('');
  } catch {
    board.innerHTML = '<li class="leaderboard-empty">Leaderboard unavailable.</li>';
  }
}

function applyIdentity(user, signedIn = true) {
  currentUser = user;
  platformStyle = (user && mapStartNgStyle(user)) || PREVIEW_STYLE;
  currentStyle = resolveStyle();
  controller?.setStyle(currentStyle);

  const isGuest = Boolean(user) && !signedIn;
  playerSignedIn = Boolean(user) && !isGuest;
  const name = currentStyle.name || PREVIEW_STYLE.name;
  const profileName = document.querySelector('#player-name');
  const profileState = document.querySelector('#profile-state');
  const profileNote = document.querySelector('#profile-note');
  const identityLink = document.querySelector('#identity-link');
  const identityLabel = document.querySelector('#identity-label');
  const identityDot = document.querySelector('#identity-dot');
  const headerAvatar = document.querySelector('#header-avatar');
  const panel = document.querySelector('.profile-panel');

  profileName.textContent = name;
  profileState.textContent = isGuest ? 'Start.ng guest · not signed in' : user ? 'Start.ng profile · synced' : START_NG ? 'Guest player' : 'Style preview';
  profileNote.textContent = user && !isGuest
    ? `Your saved Start.ng character is active in ${activeGame.title}.`
    : isGuest
      ? 'Playing as the Start.ng guest. Sign in to save your runs to the leaderboard.'
      : START_NG
        ? 'Sign in with Start.ng to bring your saved character into the run.'
        : 'Your Start.ng character appears here when this game is hosted on its Start.ng address.';
  identityLabel.textContent = user && !isGuest ? `${name.toUpperCase()} · START.NG` : START_NG ? 'SIGN IN WITH START.NG' : 'VISITOR PREVIEW';
  identityDot.classList.toggle('is-connected', Boolean(user) && !isGuest);
  identityDot.classList.toggle('is-checking', !user && START_NG);
  headerAvatar.textContent = name.slice(0, 1).toUpperCase();
  identityLink.title = user && !isGuest ? 'Signed in with Start.ng' : 'Sign in with Start.ng to use your profile';
  panel.style.setProperty('--character-skin', currentStyle.skinColor || PREVIEW_STYLE.skinColor);
  panel.style.setProperty('--character-hair', currentStyle.hairColor || PREVIEW_STYLE.hairColor);
  panel.style.setProperty('--character-top', currentStyle.primaryColor || PREVIEW_STYLE.primaryColor);
  panel.style.setProperty('--character-bottoms', currentStyle.secondaryColor || PREVIEW_STYLE.secondaryColor);
  panel.dataset.body = currentStyle.body;
}

function handleIdentityLink(event) {
  if (!START_NG || playerSignedIn) return;
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
  document.querySelector('#start-button span').textContent = game.id === 'identity-dash' ? 'Start running' : game.id === 'avatar-jump' ? 'Start climbing' : 'Take your turn';
  const hint = game.id === 'identity-dash'
    ? 'ARROWS TO MOVE|SPACE TO JUMP'
    : game.id === 'avatar-jump'
      ? 'LEFT / RIGHT TO MOVE|SPACE TO JUMP'
      : 'HOLD ↓ TO THROW BACK|← / → TO AIM · SPACE TO SLIDE';
  document.querySelector('.key-hint').innerHTML = hint.split('|').map((part) => `<span>${part}</span>`).join(' <b>·</b> ');
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
  controller = new Game(canvas, { style: currentStyle, lighting: readLighting(), onChange: updateRunUI });
}

// Daylight / evening / night, applied to whichever game is loaded without restarting it.
function setLighting(id) {
  writeLighting(id);
  controller?.setLighting?.(id);
  renderLightingOptions(id);
}

function renderLightingOptions(selected = readLighting()) {
  const host = document.querySelector('#lighting-options');
  if (!host) return;
  const presets = lightPresets();
  host.innerHTML = presets
    .map((p) => `<button type="button" class="lighting-option" data-light="${p.id}" aria-pressed="${p.id === selected}"><i class="lighting-swatch lighting-swatch--${p.id}" aria-hidden="true"></i>${p.label}</button>`)
    .join('');
  document.querySelector('#lighting-hint').textContent = presets.find((p) => p.id === selected)?.hint || '';
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
  const bestLabel = document.querySelector('.feature-best span');
  const bestValue = document.querySelector('#best-value');
  bestLabel.textContent = 'PERSONAL BEST';
  bestValue.textContent = String(state.best).padStart(3, '0');
  document.querySelector('#hud-life-label').textContent = isSalubata ? 'TURN' : activeGame.id === 'avatar-jump' ? 'LEVEL' : 'RUNS';
  document.querySelector('#life-value').textContent = isSalubata ? `${state.turn || 1}/${state.maxTurns || 4}` : activeGame.id === 'avatar-jump' ? `${Math.min(7, (state.level || 1))}/7` : `${'● '.repeat(state.lives).trim()}${state.lives ? ' ' : ''}${'○ '.repeat(3 - state.lives).trim()}`;
  hud.hidden = state.state === 'menu';
  sceneCopy.hidden = state.state !== 'menu';
  if (lastPauseState !== state.state) {
    lastPauseState = state.state;
    pauseButton.hidden = !['running', 'paused'].includes(state.state);
    pauseButton.setAttribute('aria-label', state.state === 'paused' ? 'Resume run' : 'Pause run');
    pauseButton.classList.toggle('is-resume', state.state === 'paused');
    pauseButton.innerHTML = state.state === 'paused'
      ? '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4.5 8 5.5-8 5.5z" /></svg>'
      : '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M6.5 4.5v11M13.5 4.5v11" /></svg>';
  }

  const labels = {
    paused: '<strong>Take a breather.</strong><span>Your game is paused.</span><button type="button" data-action="resume">Resume game</button><button type="button" data-action="restart">Restart</button><button type="button" class="message-secondary" data-action="home">Back to games</button>',
    over: `<strong>${state.resultTitle || 'Good game.'}</strong><span>${state.resultBody || `${state.score} metres · ${state.coins} coins`}</span><button type="button" data-action="restart">${state.resultAction || 'Play again'}</button><button type="button" class="message-secondary" data-action="home">Back to games</button>`,
    won: `<strong>${state.resultTitle || 'You made it.'}</strong><span>${state.resultBody || `${state.score} points`}</span><button type="button" data-action="restart">${state.resultAction || 'Play again'}</button><button type="button" class="message-secondary" data-action="home">Back to games</button>`,
  };
  if (labels[state.state]) {
    message.innerHTML = labels[state.state];
    message.hidden = false;
    message.querySelector('[data-action="resume"]')?.addEventListener('click', () => controller.resume());
    message.querySelector('[data-action="restart"]')?.addEventListener('click', startRun);
    message.querySelector('[data-action="home"]')?.addEventListener('click', returnHome);
  } else {
    message.hidden = true;
    message.innerHTML = '';
  }
  if (state.state === 'won' || state.state === 'over') publishRunScore(state);
  document.querySelector('#scene-caption').textContent = state.state === 'running' ? (activeGame.id === 'salubata' ? state.phaseLabel : activeGame.id === 'avatar-jump' ? 'CLIMB IN PROGRESS' : 'RUN IN PROGRESS') : activeGame.id === 'identity-dash' ? 'LAGOS AFTER DARK' : activeGame.id === 'avatar-jump' ? 'UP ABOVE THE MARKET' : 'SALUBATA STREET';
  if (state.phaseText) document.querySelector('.scene-footnote span:first-child').textContent = state.phaseText.toUpperCase();
  else document.querySelector('.scene-footnote span:first-child').textContent = activeGame.id === 'avatar-jump' ? `${state.level || 1} OF 7 PLATFORMS` : 'THREE LANES. ONE GOOD RUN.';
  if (state.turn) document.querySelector('#hud-life-label').textContent = `TURN ${state.turn}/${state.maxTurns}`;
}

function startRun() {
  scoreSent = false;
  try {
    controller.start();
  } catch (error) {
    showToast('This browser could not start the 3D game. Try a browser with WebGL enabled.');
    console.error(error);
  }
}

function returnHome() {
  scoreSent = false;
  if (controller?.returnToMenu) controller.returnToMenu();
  else if (controller) controller.state = 'menu';
  updateRunUI({ state: 'menu', score: 0, coins: 0, best: controller?.best || 0, lives: 3 });
}

startButton.addEventListener('click', startRun);
const soundButton = document.querySelector('#sound-button');
function updateSoundButton() {
  if (!soundButton) return;
  const muted = sound.isMuted();
  soundButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  soundButton.classList.toggle('is-muted', muted);
  soundButton.innerHTML = muted
    ? '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M9.5 4.5 5 8H2v4h3l4.5 3.5V4.5zM13 7l5 6M18 7l-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : '<svg aria-hidden="true" viewBox="0 0 20 20"><path d="M9.5 4.5 5 8H2v4h3l4.5 3.5V4.5zM14 7a4.5 4.5 0 0 1 0 6M16 4.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
soundButton?.addEventListener('click', () => {
  sound.toggleMute();
  updateSoundButton();
});
updateSoundButton();

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
renderLightingOptions();
renderBodyOptions();
document.querySelector('#body-options').addEventListener('click', (event) => {
  const button = event.target.closest('[data-body]');
  if (!button) return;
  const next = button.dataset.body;
  // Clicking the active option clears the override and goes back to the Start.ng look.
  setBody(next === bodyOverride ? null : next);
});
document.querySelector('#lighting-options').addEventListener('click', (event) => {
  const button = event.target.closest('[data-light]');
  if (button) setLighting(button.dataset.light);
});
let initialBest = 0;
try { initialBest = Number(localStorage.getItem('arcade:identity-dash:best') || 0); } catch {}
document.querySelector('#best-value').textContent = String(Number.isFinite(initialBest) ? initialBest : 0).padStart(3, '0');
try {
  createController();
} catch (error) {
  sceneWrap.classList.add('no-webgl');
  showToast('This browser could not start the 3D street. Try a browser with WebGL enabled.');
  console.error(error);
}

readStartNgIdentity().then((identity) => {
  applyIdentity(identity.user, identity.signedIn);
  if (identity.status === 'unavailable' && START_NG) {
    document.querySelector('#profile-note').textContent = 'Start.ng sign-in could not be checked. Reload this game to try again.';
  }
  refreshLeaderboard();
}).catch((error) => {
  console.warn('Start.ng sign-in check failed.', error);
  refreshLeaderboard();
});
onStartNgUserChange((user) => {
  applyIdentity(user);
  refreshLeaderboard();
});

window.addEventListener('pagehide', () => controller?.dispose(), { once: true });
