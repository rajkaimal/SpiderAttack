# Spider Attack

Spider Attack is a fast-paced, wave-based browser shooter where spiders pour in from deep space and close in on your position at the center of the screen. Survive all 10 waves, manage your ammo, and keep your health above zero to win.

## How to Play

- **Objective**: Destroy every spider across all 10 waves before your health reaches 0.
- **Aiming**: Move your mouse (or tap on mobile); the neon crosshair tracks your cursor.
- **Shoot**: **Left-click** (or **tap**) to fire. You have **10 bullets per clip**.
- **Accuracy Rule**: Hit registration is centered on the spider body with only light aim assist. Random spray is much less effective.
- **Miss Penalty**: Missing a shot applies a brief shot delay before the next shot can fire.
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
The game consists of 10 waves of increasing difficulty. Each wave spawns a set number of spiders that crawl toward the center of the screen. Early waves start with 10 slow spiders; by wave 10 you're facing 60 fast, weaving spiders. A wave ends when every spider in that wave has been killed or has reached you. Between waves, a brief "Get ready!" transition gives you a moment to prepare.

### Spiders
Spiders spawn at the edges of the screen and move inward along a straight path toward the center. They start as tiny dots on the horizon and grow larger as they approach, matching the parallax depth of the starfield behind them. From wave 5 onward, spiders gain a sinusoidal weave to their path, making them harder to hit. Each spider is rendered as pixel art with a body, animated legs, eyes, and pupils that track toward the center.

### Damage
Spiders deal damage in two ways. When a spider gets very close (past 65% of its path), it continuously gnaws at your health — the closer it gets, the faster the drain. If a spider reaches you completely (100% progress), it bites for a heavy 16 damage and disappears. Your max health is 100, and the screen flashes red when you take damage.

### Ammo & Reload
You have a 10-round clip shown as bullet pips in the bottom-left. Each shot uses one bullet. When empty, a "RELOAD!" warning flashes on screen. Reloading takes 1 second with a visual progress arc. You can reload at any time, even with bullets remaining — useful for topping off between waves.

### Scoring & Combos
Points are awarded per kill based on spider size at the moment of death — smaller spiders are harder to hit and worth more (tiny: 150, small: 80, medium: 40, large: 15). Consecutive hits without a miss build your combo counter. At 3 hits you earn a 1.5x multiplier; at 5 hits it jumps to 2x. Missing a shot resets the combo to zero and applies a short shot delay. Clearing a wave awards a bonus based on wave number. The end screen breaks down your total score into kill points, combo bonus, and wave bonus.

## Controls

### Desktop
- **Move mouse**: Aim crosshair
- **Left-click**: Shoot
- **Right-click**: Reload

### Mobile
- **Tap**: Shoot at tap location
- **Reload button**: On-screen button in the bottom-right corner

## Features

- **10 progressive waves** with increasing spider count and speed; later waves add weaving movement
- **Parallax starfield** background with depth-matched spider scaling
- **Combo system** with score multiplier for consecutive hits
- **Sound effects** — synthesized with Web Audio API (no audio files needed):
  - Sharp snap for shooting
  - Low-volume thud for spider kills
  - Mechanical click for reload
- **Visual effects**:
  - Muzzle flash at crosshair on shot
  - Burn-up death animation (white-hot core fading to orange)
  - Damage flash overlay when hit
  - Neon crosshair with glow
- **End screen** with full stats breakdown: wave reached, kills, accuracy, best combo, and score table (kill points, combo bonus, wave bonus)
- **Mobile support** with touch input, on-screen reload button, and larger hit radius
- **Pixel-art spider rendering** with animated legs and eye detail

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

Tests use [Vitest](https://vitest.dev/) and cover the pure game logic extracted into `game-logic.js`:
- Score calculation by spider radius (boundary values, tier ordering)
- Combo multiplier thresholds
- Hit detection (distance-based, diagonal, boundary edge cases)
- Wave data validation (10 waves, increasing difficulty, weave flags)
- Constants validation

## Project Structure

```
SpiderAttack/
  index.html          Entry point — loads canvas and game module
  style.css           Full-screen canvas styling, touch-action support
  game.js             Game loop, rendering, input, audio, state management
  game-logic.js       Exported pure functions and constants (shared by game + tests)
  tests/
    game-logic.test.js  28 tests covering scoring, combos, hit detection, wave data
  package.json        npm scripts (test, test:watch)
```
