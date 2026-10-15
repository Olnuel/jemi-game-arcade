# Start.ng Arcade

Three.js arcade prototype for Identity Dash, Avatar Jump, and Salubata. The first playable title is Identity Dash.

## Run locally

```sh
npm install
npm run dev
```

Production output is created with `npm run build`.

## Current scope

- Identity Dash is playable with three lanes, moving obstacles, jumpable barriers, coins, lives, pause/resume, restart, score, and a saved local personal best.
- Avatar Jump and Salubata are listed as in development.
- One shared Three.js player-character builder consumes Start.ng's centrally managed body, skin, outfit, hair, hat, and accessory style fields.
- On a `*.start.ng` game address, the adapter asks the documented `https://start.ng/connect` page for `{ id, name, style }` through a source- and origin-checked `postMessage` handshake. It never reads or stores Start.ng credentials or email.
- On a Start.ng address, signed-in players see their account name and saved look in Identity Dash. Signed-out players can use the Start.ng sign-in return flow; local previews remain guests.
- The Start.ng integration follows the public [Lane Dash platform example](https://github.com/Blackburn0/HNG-Game), including its `startng:whoami` message and style field schema. End-to-end confirmation for this arcade requires uploading it and opening the resulting `*.start.ng` address.

To confirm the hosted integration, upload this public repository through the Start.ng profile's **Your games** section and open the assigned game address. The browser-hosted connect endpoint is unavailable from ordinary `localhost` or GitHub Pages origins.

