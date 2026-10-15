---
name: Start.ng Arcade
description: Three Lagos night-market games carried by one player identity.
colors:
  mint-primary: "#59dec5"
  market-orange: "#f19453"
  coin-gold: "#f2cb82"
  ground-neutral: "#101716"
  panel-neutral: "#18211f"
  panel-raised: "#202b28"
  ink-neutral: "#f4f0e7"
  muted-neutral: "#a6aca7"
  line-neutral: "#34403c"
typography:
  display:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "clamp(60px, 8.2vw, 108px)"
    fontWeight: 700
    lineHeight: 0.91
    letterSpacing: "-0.055em"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "DM Mono, Cascadia Code, monospace"
    fontSize: "9px"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  edge: "0px"
  pill: "999px"
  circle: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.mint-primary}"
    textColor: "#11211d"
    rounded: "{rounded.edge}"
    padding: "0 18px 0 22px"
    height: "52px"
  identity-chip:
    backgroundColor: "{colors.panel-neutral}"
    textColor: "{colors.ink-neutral}"
    rounded: "{rounded.pill}"
    padding: "0 9px 0 12px"
    height: "36px"
---

# Design System: Start.ng Arcade

## Overview

**Creative North Star: “Lagos Market Night, In Motion.”**

The arcade places the player in a living Lagos street after dark: teal shop light, warm roadside lamps, painted stalls, produce, and small signs surround each playable Three.js world. Identity Dash, Avatar Jump, and Salubata share one character and one visual language while each game keeps its own clear play space.

The selection screen introduces the selected game over its 3D scene. Once a run starts, the world takes the full viewport and the surrounding site UI recedes. Score, turn or level, pause, touch controls, and result actions stay attached to the game so play can begin and end without losing context.

**Key Characteristics:**
- Night-market atmosphere built from warm orange light and mint-teal accents.
- Square editorial controls over dimensional, low-poly 3D streets.
- A shared centrally styled character appears in all three games.
- Full-screen play with compact in-world HUD and accessible exit controls.

## Colors

The palette pairs deep painted-street neutrals with warm stall light, mint shop glow, and coin gold.

### Primary
- **Market Mint**: primary action, active game states, lane and platform accents.

### Secondary
- **Roadside Orange**: market signage, warm lamps, warning and secondary emphasis.

### Tertiary
- **Coin Gold**: collectibles, scores, and small play-state highlights.

### Neutral
- **Night Ground**: page background and the darkest game surfaces.
- **Market Panel**: HUD and result surfaces.
- **Raised Stall**: raised UI surface and highlighted selection row.
- **Warm Ink**: primary type over dark surfaces.
- **Street Mist**: secondary text and utility labels.
- **Road Divider**: panel edges and shelf separators.

## Typography

**Display Font:** Manrope (with Segoe UI, sans-serif fallback)
**Body Font:** Manrope (with Segoe UI, sans-serif fallback)
**Label/Mono Font:** DM Mono (with Cascadia Code, monospace fallback)

**Character:** Manrope carries bold, friendly game titles and concise instructions. DM Mono gives scores, coordinates, and control hints the compact precision of an arcade HUD.

### Hierarchy
- **Display** (700, responsive 60–108px, 0.91 line-height): selected game title.
- **Body** (400, 14px, 1.75 line-height): game description and player guidance.
- **Label** (400, 9px, 0.1em tracking, uppercase): HUD, status, controls, and coordinates.

## Layout

The selection view uses a wide playable scene beside a narrow game shelf on desktop; the scene and shelf stack on smaller screens. During play, the canvas becomes fixed to the full viewport, with the header, shelf, and profile panel hidden. Safe-area insets keep the HUD, pause action, touch controls, and result panel clear of device edges. Returning to the menu restores the selection layout.

## Elevation & Depth

The interface uses thin borders and tonal surfaces for structure, with soft offset shadows reserved for the scene frame, result panel, and toast. The game worlds provide most depth through Three.js lighting, fog, material response, player shadows, and objects at different heights and distances.

## Shapes

Buttons, game rows, and message panels keep square corners to echo painted street signs and arcade cabinets. The account chip is pill-shaped; the pause control, player avatar, and collectible markers use circular forms. Thin borders define the interface without card-like nested framing.

## Components

### Primary Button
- Square mint action with dark text and a short upward hover movement.
- The play action changes its label to match the selected game.

### Game Row
- Full-width selection row separated by a thin road-divider line.
- The active game shifts slightly and receives a mint inset edge.

### Identity Chip
- Compact pill showing visitor, checking, or signed-in identity status.
- The preview state stays distinct from a verified Start.ng profile.

### Game HUD
- Translucent dark strip pinned to the top of the full-screen scene.
- Score and game-specific collectible, run, turn, or level counts remain visible.

### Pause and Result Panel
- Circular pause action; centered square result panel with a clear resume, replay, or return action.
- Pausing and finishing keep the game in full-screen mode until the player returns to the arcade.

### Touch Controls
- Large bordered movement and action controls close to the bottom edge during active play on touch layouts.
- Controls use the current game’s action label and remain above the canvas.

## Do's and Don'ts

### Do:
- **Do** keep active gameplay full-screen and keep pause or return actions reachable.
- **Do** use the shared character builder and pass through centrally supplied style fields.
- **Do** reserve mint for active states and warm orange for street lighting and signs.
- **Do** keep gameplay instructions specific to the selected title.

### Don't:
- **Don't** show the visitor preview as a verified Start.ng session.
- **Don't** cover a running game with selection or profile panels.
- **Don't** make decorative market scenery intersect platform, road, slipper, or collectible gameplay paths.
- **Don't** treat local browser checks as proof of the hosted Start.ng identity handshake.
