# Start.ng Arcade

Three.js arcade with three playable games: Identity Dash, Avatar Jump, and Salubata.

## Run locally

```sh
npm install
npm run dev
```

Production output is created with `npm run build`.

## Current scope

- Identity Dash is an endless three-lane runner with moving obstacles, jumpable barriers, coins, lives, pause/resume, restart, score, and a saved local personal best.
- Avatar Jump is a seven-platform vertical climbing game with left/right movement, jump physics, one-way platform collision detection, collectible stars, a rooftop finish, fall failure, pause, and restart. The fall condition is tied to the course height so the following camera cannot prevent a missed jump from ending the run.
- Salubata is a local two-player pass-the-phone match. Players alternate a charged backward slipper throw, a short walk to the landing mark, and a charged ground slide aimed with left/right. Sliding collisions award removed rubber bands to the active player; the match ends when all nine bands leave the circle, and the player with the larger collection wins. The logged-in Start.ng character styling is applied through the shared character system. Computer opponents, online rooms, unlocks, sound, and mobile flick/spin physics are not implemented.
- All three games use the shared Three.js player-character builder and accept the same centrally managed body, skin, outfit, hair, hat, and accessory style fields.
- On a `*.start.ng` game address, the adapter asks the documented `https://start.ng/connect` page for `{ id, name, style }` through a source- and origin-checked `postMessage` handshake. It never reads or stores Start.ng credentials or email.
- On a Start.ng address, signed-in players see their account name and saved look in whichever game is selected. Signed-out players can use the Start.ng sign-in return flow; local previews remain guests.
- The Start.ng integration follows the public [Lane Dash platform example](https://github.com/Blackburn0/HNG-Game), including its `startng:whoami` message and style field schema. End-to-end confirmation for this arcade requires uploading it and opening the resulting `*.start.ng` address. Hosted identity and styling have not yet been verified for this arcade.

## Controls

- **Identity Dash:** Left/right arrows or A/D to change lanes; Space, Up, or W to jump; Escape to pause; touch buttons or a swipe also work.
- **Avatar Jump:** Left/right arrows or A/D to steer; Space, Up, or W to jump; Escape to pause; R or the result button restarts after a finish or fall. Touch buttons work on mobile.
- **Salubata:** Pass the phone between Player 1 and Player 2. Hold Down or S, then release to throw the slipper behind you and set the throwing mark. After the walk to the mark, aim left/right; hold Up or Space, then release for the ground slide. On mobile, hold the THROW button to charge. Escape pauses; R or the result button starts a new match.

To confirm the hosted integration, upload this public repository through the Start.ng profile's **Your games** section and open the assigned game address. The browser-hosted connect endpoint is unavailable from ordinary `localhost` or GitHub Pages origins.

## Verification

- `npm run check` validates JavaScript syntax for the arcade, game, and identity modules. It is not a unit-test suite.
- `npm run build` creates the static production bundle in `dist/`.
- The current feature branch was played in a browser at `http://localhost:5200/`: Avatar Jump movement, jump, star collection, missed-landing failure, restart, and pause/resume were checked. Salubata's pass-the-phone turn flow, backward throws, animated walk-to-mark, left/right aiming, ground slides, score attribution, removal of all nine bands, win state, restart, and return to menu were checked. Identity Dash movement/jump, pause/resume, and menu navigation were checked. These local browser checks use the visitor preview profile.
- The Start.ng hosted identity handshake and centrally managed style delivery are implemented against the documented adapter example, but remain unverified on an actual `*.start.ng` game address. Local browser gameplay does not verify hosted identity.
