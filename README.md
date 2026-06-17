# Checkers Game

> [!NOTE]
> This is a legacy checkers project originally built on Replit. The original Replit-based implementation can be found on the `og-version` branch. This `main` branch features a 2026 refresh completed with the help of AI to resolve strict-mode ReferenceErrors, PieceTracker crashes, and AI double-jump freezes, getting it running cleanly on GitHub Pages.

A fully-featured, classic Checkers (Draughts) game developed by Dan Sharan. This web application runs completely client-side in the browser and supports both 2-player local pass-and-play and single-player matches against a Minimax-based AI.

## Features

- **Local pass-and-play (2 Players)**: Play Checkers against a friend on the same screen.
- **VS AI Mode (1 Player)**: Challenge a built-in computer opponent powered by the **MiniMax algorithm with Alpha-Beta pruning**.
- **Forced Jumps Option**: Optional enforcement of the classic Checkers rule where a player must capture an opponent's piece if a jump is available.
- **Time Controls**: Interactive clocks for both players with a Fischer-style time increment (adds 3 seconds to the active player's clock after every move).
- **Captured Piece Trackers**: Visual indicators tracking the number of captured pieces next to the timers.
- **Classic Sound Effects**: Immersive sounds for game start, moving, capturing, and winning.
- **Highly Customizable Visuals**:
  - **Styles**: Dark Mode, Light Mode, and default classic wood style.
  - **Themes**:
    - Default (Classic Wood)
    - Classic (Dark/Red)
    - Ice (Dark Blue/Light Blue)
    - Beach (Blue/Sand)
    - Forest (Dark Green/Light Green)
    - Pink (Pink/Light Pink)
    - Ukraine (Blue/Yellow)

## Technical Architecture

The project is built using a modular ES module structure:
- **`game.js`**: The heart of the application, connecting the UI, event listeners, piece movement logic, and turn timer loops.
- **`AI.js`**: Implements the MiniMax engine, heuristic evaluation, and alpha-beta pruning search tree.
- **`fPos.js`**: Defines the physical representation of a game position used by the AI engine.
- **`vPos.js`**: Manages visual layouts and coordinates of checkerboard tiles and pieces.
- **`checker.js`**: The checker piece class representing individual checkers, colors, kings, and life status.
- **`move.js`**: Tracks starting coordinates, destination coordinates, and move types (simple vs capture).
- **`checkerSound.js`**: Handles audio playback for various in-game sound effects.
- **`pieceTracker.js`**: Manages the captured piece visual queue.
- **`lodash.js`**: Utilized for deep-cloning game states in the AI search tree.

## Setup & How to Run

1. Clone or download this repository.
2. Open `index.html` in any modern web browser to view the homepage.
3. Click "Play Checkers" to navigate to `game.html` and begin playing!
4. Since the project utilizes ES modules (`type="module"`), you will need to serve it via a local static web server to avoid browser CORS errors (e.g., run `bunx http-server` or `python -m http.server` from the root directory).
