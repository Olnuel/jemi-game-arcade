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
- Salubata is a local two-player pass-the-phone match. Players alternate a charged backward slipper throw, a short walk to the landing mark, and a charged ground slide aimed with left/right. Sliding collisions award removed rubber bands to the active player; the match ends when all nine bands leave the circle, and the player with the larger collection wins. It uses the shared player character and applies the style object received from the Start.ng adapter. Computer opponents, online rooms, unlocks, sound, and mobile flick/spin physics are not implemented.
- All three games use the shared Three.js player-character builder and accept the same body, skin, outfit, hair, hat, and accessory style fields. Locally they use the visitor-preview style; actual centrally managed Start.ng values have not been verified for this hosted game.
- On a `*.start.ng` game address, the adapter asks the documented `https://start.ng/connect` page for `{ id, name, style }` through a source- and origin-checked `postMessage` handshake. It never reads or stores Start.ng credentials or email.
- The adapter is designed to apply a Start.ng account name and saved look across whichever game is selected when the platform supplies them. Signed-out players have a sign-in return flow; local previews remain guests. End-to-end identity and style delivery for this game remain unverified.
- The Start.ng integration follows the public [Lane Dash platform example](https://github.com/Blackburn0/HNG-Game), including its `startng:whoami` message and style field schema. End-to-end confirmation for this arcade requires uploading it and opening the resulting `*.start.ng` address. Hosted identity and styling have not yet been verified for this arcade.

## Controls

- **Identity Dash:** Left/right arrows or A/D to change lanes; Space, Up, or W to jump; Escape to pause; touch buttons or a swipe also work.
- **Avatar Jump:** Left/right arrows or A/D to steer; Space, Up, or W to jump; Escape to pause; R or the result button restarts after a finish or fall. Touch buttons work on mobile.
- **Salubata:** Pass the phone between Player 1 and Player 2. Hold Down or S, then release to throw the slipper behind you and set the throwing mark. After the walk to the mark, aim left/right; hold Up or Space, then release for the ground slide. On mobile, hold the THROW button to charge. Escape pauses; R or the result button starts a new match.

To confirm the hosted integration, upload this public repository through the Start.ng profile's **Your games** section and open the assigned game address. The browser-hosted connect endpoint is unavailable from ordinary `localhost` or GitHub Pages origins.

## Verification

- `npm run check` validates JavaScript syntax for the arcade, game, and identity modules. It is not a unit-test suite.
- `npm run build` creates the static production bundle in `dist/`.
- The current review branch was played in a browser at `http://localhost:5201/`: Avatar Jump launch, jump/platform progress, steering input, star collection and score changes, and pause/resume were checked. A fall failure and a full seven-platform finish were not confirmed in this run. Salubata's pass-the-phone turn flow, backward throws, animated walk-to-mark, left/right aiming, ground slides, score attribution, removal of all nine bands, win state, restart, pause, and return to menu were checked. Identity Dash launch, movement/jump input, distance updates, pause, and return-to-menu navigation were checked. These local browser checks use the visitor preview profile.
- The Start.ng hosted identity handshake and centrally managed style delivery are implemented against the documented adapter example, but remain unverified on an actual `*.start.ng` game address. Local browser gameplay does not verify hosted identity.
