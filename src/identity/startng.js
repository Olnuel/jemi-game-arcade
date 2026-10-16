import { normalizeCharacterStyle } from './player-character.js';

// Start.ng owns sign-in and profile styling. Games hosted on a Start.ng subdomain
// ask the platform's same-origin parent domain through its documented connect page.
function findStartNg() {
  const { hostname, protocol } = window.location;
  if (hostname.endsWith('.start.ng')) return 'https://start.ng';
  if (hostname.endsWith('.start.localhost')) return `${protocol}//start.localhost:5173`;
  return null;
}

export const START_NG = findStartNg();

let connectFrame = null;

function getConnectFrame() {
  connectFrame ??= new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.src = `${START_NG}/connect`;
    frame.hidden = true;
    frame.title = 'Start.ng sign-in check';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Start.ng connect iframe timed out.'));
    }, 5000);
    function cleanup() {
      clearTimeout(timeout);
      frame.removeEventListener('load', onLoad);
      frame.removeEventListener('error', onError);
      if (frame.parentElement) frame.remove();
      connectFrame = null;
    }
    function onLoad() {
      clearTimeout(timeout);
      resolve(frame);
    }
    function onError(err) {
      cleanup();
      reject(err);
    }
    frame.addEventListener('load', onLoad, { once: true });
    frame.addEventListener('error', onError, { once: true });
    document.body.append(frame);
  });
  return connectFrame;
}

async function askPlatform(message, replyType, timeoutMs = 3000) {
  if (!START_NG) return undefined;

  let frame;
  try {
    frame = await getConnectFrame();
  } catch {
    return undefined;
  }

  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const finish = (reply) => {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = window.setTimeout(() => finish(undefined), timeoutMs);

    function onMessage(event) {
      if (event.origin !== START_NG || event.source !== frame.contentWindow) return;
      if (event.data?.type === replyType && event.data.requestId === requestId) finish(event.data);
    }

    window.addEventListener('message', onMessage);
    frame.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

async function checkStartNgUser() {
  if (!START_NG) return undefined;
  const reply = await askPlatform({ type: 'startng:whoami' }, 'startng:user');
  return reply === undefined ? undefined : (reply.user ?? null);
}

export async function readStartNgIdentity() {
  if (!START_NG) {
    return { status: 'unavailable', user: null, reason: 'Sign-in is available when the game is hosted on Start.ng.' };
  }

  const user = await checkStartNgUser();
  if (user === undefined) {
    return { status: 'unavailable', user: null, reason: 'Start.ng did not answer the sign-in check.' };
  }
  return {
    status: user ? 'connected' : 'signed-out',
    user,
    reason: user ? 'Connected to your Start.ng character.' : 'Sign in with Start.ng to use your saved character.',
  };
}

export function mapStartNgStyle(user) {
  if (!user || typeof user !== 'object') return null;
  const style = normalizeCharacterStyle(user.style);
  return {
    ...style,
    name: typeof user.name === 'string' && user.name.trim() ? user.name.trim().slice(0, 24) : 'Player',
  };
}

export function onStartNgUserChange(callback) {
  if (!START_NG) return () => {};

  const recheck = async () => {
    if (document.visibilityState !== 'visible') return;
    const user = await checkStartNgUser();
    if (user !== undefined) callback(user);
  };
  document.addEventListener('visibilitychange', recheck);
  window.addEventListener('focus', recheck);
  return () => {
    document.removeEventListener('visibilitychange', recheck);
    window.removeEventListener('focus', recheck);
  };
}

export function startNgSignIn() {
  if (!START_NG) return false;
  const returnTo = encodeURIComponent(window.location.href);
  window.location.href = `${START_NG}/?return_to=${returnTo}`;
  return true;
}

