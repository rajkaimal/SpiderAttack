 # Spider Attack

Spider Attack is a fast-paced, wave-based browser shooter where spiders pour in from deep space and close in on your position at the center of the screen. Survive all 10 waves, manage your ammo, and keep your HP above zero to win.

## How to Play

- **Objective**: Destroy every spider across all 10 waves before your health reaches 0.
- **Aiming**: Move your mouse; the neon crosshair tracks your cursor.
- **Shoot**: **Left-click** to fire. You have **10 bullets per clip**.
- **Reload**: **Right-click** to reload; it takes about **1 second**, during which a reload arc fills up.
- **Health**:
  - Your HP bar is shown in the top-left.
  - Spiders that reach the center bite you for a chunk of damage.
  - Spiders very close to you will “gnaw” and drain HP over time.
- **Scoring**:
  - **Smaller spiders = more points**.
  - Consecutive hits increase your **combo multiplier** (up to ×2), boosting your score.
  - Clearing a wave grants a **wave bonus**.
- **Win / Lose**:
  - **Win** by clearing every spider in all 10 waves.
  - **Lose** if your HP drops to 0.

## Controls

- **Move mouse**: Aim crosshair.
- **Left-click**: Shoot.
- **Right-click**: Reload.
- **Click** on start screen: Begin the game.
- **Click** on game over / victory screens: Return to the start screen.

## Running the Game Locally

This is a pure HTML5 canvas game with no build step or external dependencies.

1. Clone the repository or download the source.
2. Open `index.html` in a modern desktop browser (Chrome, Edge, Firefox, etc.).
3. Make sure the browser window is maximized so the canvas can fill the screen.
4. Move your mouse and click to start playing.

> Tip: For the best experience, play in full-screen and enable hardware acceleration in your browser.

## Files

- `index.html` – Entry point that sets up the canvas and loads the game.
- `style.css` – Minimal styling to make the canvas full-screen and hide the default cursor.
- `game.js` – All game logic, rendering, wave management, scoring, and input handling.

