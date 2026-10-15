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
- One shared Three.js player-character builder consumes a normalized style object. The displayed visitor preview uses a local palette.
- The Start.ng identity module is deliberately unconfigured. The inspected repository and available public documentation did not provide a supported session, profile-style schema, or SDK contract. The app does not claim to sign users in or to use their actual managed styling.

To complete that integration, supply the authoritative Start.ng app session integration guide and the centrally managed character-style schema/SDK. The `src/identity/startng.js` adapter is the single place to map those verified inputs.

