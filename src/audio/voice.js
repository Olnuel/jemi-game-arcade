// Spoken feedback for run results, using the browser's speech synthesis.
// Nigerian-flavoured encouragement: congratulates a win, encourages a loss.
// Always degrades quietly: if the browser has no voices, or the player has muted
// sound, nothing happens and the game carries on.

const VOICE_KEY = 'arcade:voice';

let cached = false;
let voices = [];

function loadVoices() {
  if (!cached || typeof window === 'undefined' || !window.speechSynthesis) return voices;
  const list = window.speechSynthesis.getVoices();
  if (list.length) voices = list;
  return voices;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  cached = true;
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

function readMuted() {
  try { return localStorage.getItem('arcade:sound:muted') === 'true'; } catch { return false; }
}

export function readVoiceEnabled() {
  try { return localStorage.getItem(VOICE_KEY) !== 'off'; } catch { return true; }
}

export function writeVoiceEnabled(on) {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
  if (!on) cancel();
}

/** True when this browser can actually speak. */
export function voiceSupported() {
  return typeof window !== 'undefined' && Boolean(window.speechSynthesis);
}

function pickVoice() {
  const list = loadVoices();
  if (!list.length) return null;
  // Prefer a Nigerian or West African English voice when the platform offers one.
  const preferred = list.find((voice) => /en-NG|en-NG/i.test(voice.lang))
    || list.find((voice) => /^en[-_]/i.test(voice.lang) && /female|samantha|karen|zira/i.test(voice.name))
    || list.find((voice) => /^en[-_]/i.test(voice.lang));
  return preferred || list[0];
}

export function cancel() {
  if (!voiceSupported()) return;
  try { window.speechSynthesis.cancel(); } catch { /* nothing to cancel */ }
}

/** Speaks one line, replacing anything already playing. Never throws. */
export function speak(text, { rate = 1.02, pitch = 1.06 } = {}) {
  if (!voiceSupported() || !text) return false;
  if (!readVoiceEnabled() || readMuted()) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 0.95;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

// Picked at random so repeated runs do not sound like a machine.
const pick = (lines) => lines[Math.floor(Math.random() * lines.length)];

const LINES = {
  'identity-dash': {
    won: [
      'You did well! Clean run, no wahala.',
      'Chop life! That was a proper run.',
      'Sharp! You cross the whole street.',
    ],
    lost: [
      'No wahala. Take the next one, you go make it.',
      'That one got you, but small small. Try again.',
      'Do not give up. One more run.',
    ],
  },
  'avatar-jump': {
    won: [
      'You climb am reach! E no easy.',
      'Top of the world! You take am.',
      'You reach the top! Sharp sharp.',
    ],
    lost: [
      'You nearly get there. Try again, you go reach am.',
      'The fall catch you. Go back and climb again.',
      'Do not give up. The rooftop dey wait for you.',
    ],
  },
  salubata: {
    won: [
      'Street champion! All the bands gone.',
      'You clear am! Every band don go.',
      'Sharp! The circle no get you.',
    ],
    lost: [
      'Your turns don finish, but you nearly get there.',
      'Try again small small, you go win am.',
      'Do not give up. One more round.',
    ],
  },
};

export function speakResult(game, outcome) {
  const set = LINES[game] || LINES['identity-dash'];
  const lines = outcome === 'won' ? set.won : set.lost;
  return speak(pick(lines));
}