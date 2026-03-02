# Spider Attack

Spider Attack is a fast-paced, wave-based browser shooter where spiders pour in from deep space and close in on your position at the center of the screen. Survive all 10 waves, manage your ammo, and keep your health above zero to win.

## How to Play

- **Objective**: Destroy every spider across all 10 waves before your health reaches 0.
- **Aiming**: Move your mouse (or tap on mobile) and keep shots close to spider bodies.
- **Shoot**: **Left-click** (or **tap**) to fire. You have **10 bullets per clip**.
- **Accuracy Rule**: Hit registration uses spider size plus light aim assist (`spiderRadius * 0.75 + assist`), so random spray is much less effective.
- **Miss Penalty**: Missing a shot applies a brief shot delay before the next shot can fire.
- **Mobile Fire Rate**: Mobile has a fixed minimum delay between shots to prevent tap-spam.
- **Spawn Grace**: Newly spawned spiders cannot be hit for a very short moment.
- **Reload**: **Right-click** (or tap the **reload button** on mobile) to reload; it takes about **1 second**, during which a reload arc fills up.
- **Health**:
  - Your health bar is shown in the top-left.
  - Spiders that reach the center bite you for a chunk of damage.
  - Spiders very close to you will gnaw and drain health over time.
- **Scoring**:
  - **Smaller spiders = more points** (150 / 80 / 40 / 15 based on size).
  - Consecutive hits increase your **combo multiplier** (3 hits = 1.5x, 5 hits = 2x).
  - Clearing a wave grants a **wave bonus**.
- **Win / Lose**:
  - **Win** by clearing every spider in all 10 waves.
  - **Lose** if your health drops to 0.

## Game Mechanics

### Waves
The game consists of 10 waves of increasing difficulty. Each wave spawns a set number of spiders that rush toward your position. Early waves start with 10 slower spiders; by wave 10 you're facing 60 fast, weaving spiders. As waves increase, spawn intervals shorten, spawn batches get larger, and close-range damage pressure increases. A wave ends when every spider in that wave has been killed or has reached you. Between waves, a brief "Get ready!" transition gives you a moment to prepare.

### Spiders
Spiders originate near the center horizon with randomized origin jitter and expand outward toward the player view, growing as they approach to match the starfield depth effect. From wave 5 onward, spiders gain sinusoidal weave movement, making them harder to track and hit. Each spider is rendered as pixel art with a body, animated legs, eyes, and pupils.

### Damage
Spiders deal damage in two ways. When a spider gets very close (past 65% of its path), it continuously gnaws at your health — the closer it gets, the faster the drain. If a spider reaches you completely (100% progress), it bites for chunk damage and disappears. Both bite and gnaw pressure scale up by wave. Your max health is 100, and the screen flashes red when you take damage.

### Ammo & Reload
You have a 10-round clip shown as bullet pips in the bottom-left. Each shot uses one bullet. When empty, a "RELOAD!" warning flashes on screen. While reloading, a "RELOADING..." status appears at the same location. Reloading takes 1 second with a visual progress arc/ring. You can reload at any time, even with bullets remaining — useful for topping off between waves.

### Scoring & Combos
Points are awarded per kill based on spider size at the moment of death — smaller spiders are harder to hit and worth more (tiny: 150, small: 80, medium: 40, large: 15). Consecutive hits without a miss build your combo counter. At 3 hits you earn a 1.5x multiplier; at 5 hits it jumps to 2x. Missing a shot resets the combo to zero and applies a short shot delay. Clearing a wave awards a bonus based on wave number. The end screen breaks down your total score into kill points, combo bonus, and wave bonus.

## Controls

### Desktop
- **Move mouse**: Aim crosshair
- **Left-click**: Shoot
- **Right-click**: Reload

### Mobile
- **Tap**: Shoot at tap location
- **Reload button**: On-screen button on the lower-right, with large tap radius and label

## Features

- **10 progressive waves** with increasing speed/count, weave movement, faster spawn cadence, bigger spawn batches, and stronger close-range pressure
- **Parallax starfield** background using tiny speck-style stars
- **Combo system** with score multiplier for consecutive hits
- **Anti-spam shooting rules** (miss delay, mobile minimum shot interval, spawn grace)
- **Sound effects** — synthesized with Web Audio API (no audio files needed):
  - Laser-like shooting pulse
  - Low-volume thud for spider kills
  - Mechanical click for reload
  - Damage warning ping when health is dropping
- **Visual effects**:
  - Directional blue muzzle flash (streak + cone + core halo)
  - Warm death bloom with lingering ember particles
  - Damage flash overlay when hit
  - Neon crosshair with glow
- **End screen** with full stats breakdown: wave reached, kills, accuracy, best combo, and score table (kill points, combo bonus, wave bonus)
- **Mobile support** with touch input, larger reload tap target, and readability-tuned overlays
- **Pixel-art spider rendering** with animated legs and eye detail

## Code Architecture

The runtime is now split into focused modules so each system is easier to reason about and maintain.

- **`game.js`**: Main orchestrator. Initializes modules, owns top-level state reference, runs the frame loop, and coordinates phase flow.
- **`game-logic.js`**: Pure/shared gameplay functions and constants used by both runtime and tests.
- **`game-audio.js`**: Web Audio setup and synthesized sound effects (`shoot`, `kill`, `reload`, `damage`).
- **`game-stars.js`**: Starfield initialization, per-frame update, and drawing.
- **`game-spider.js`**: Spider entity class (movement/progression + pixel-art rendering).
- **`game-renderer.js`**: HUD and screen rendering (start/game-over/victory overlays, muzzle flash, crosshair, wave transition).
- **`game-input.js`**: Desktop and mobile input event wiring with phase-aware behavior.
- **`gameplay-systems.js`**: Core gameplay systems (shooting, combo updates, reload flow, wave spawning/progression).
- **`game-state.js`**: Initial state factory (single source of truth for state shape/reset defaults).
- **`game-viewport.js`**: DPR-aware canvas sizing and UI scale/view size helpers.

## Running the Game Locally

This is a pure HTML5 canvas game with no build step required.

1. Clone the repository:
   ```
   git clone https://github.com/rajkaimal/SpiderAttack.git
   ```
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
3. Make sure the browser window is maximized so the canvas can fill the screen.

> **Note**: The game uses ES modules, so you may need to serve it via a local server (e.g. `npx serve`) if your browser blocks module imports from `file://` URLs.

## Running Tests

```
npm install
npm test
```

Tests use [Vitest](https://vitest.dev/) and currently cover the pure logic in `game-logic.js`:
- Score calculation by spider radius (boundary values, tier ordering)
- Combo multiplier thresholds
- Hit detection (distance-based, diagonal, boundary edge cases)
- Wave data validation (10 waves, increasing difficulty, weave flags)
- Constants validation

## Project Structure

```
SpiderAttack/
  index.html             Entry point — loads canvas and runtime module
  style.css              Full-screen canvas styling, touch-action support
  game.js                Runtime orchestrator (module wiring + main loop)
  game-logic.js          Pure shared constants/functions (runtime + tests)
  game-audio.js          Audio context + synthesized SFX
  game-stars.js          Starfield system (init/update/draw)
  game-spider.js         Spider entity class and drawing
  game-renderer.js       HUD/screen/VFX rendering layer
  game-input.js          Desktop/mobile input wiring
  gameplay-systems.js    Shooting/reload/wave/combo gameplay systems
  game-state.js          Initial state factory
  game-viewport.js       DPR-aware viewport/canvas sizing helpers
  tests/
    game-logic.test.js  28 tests covering scoring, combos, hit detection, wave data
  package.json           npm scripts (test, test:watch)
```
