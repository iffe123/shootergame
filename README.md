# Neon Siege

A lightweight first-person shooter demo for the browser, built from scratch with Three.js and Vite.

## What it shows

- First person mouse look with pointer lock
- WASD movement and jumping
- Touch HUD for iPhone and iPad
- Click-to-shoot enemy drones with visible weapon feedback
- Stage progression with star-core objectives
- Minimap guidance for player position, enemies, obstacles, and the next objective
- Health, score, and HUD
- Zero backend required, which makes it easy to deploy on Vercel

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Controls

- `W A S D`: move
- `Mouse`: look around
- `Space`: jump
- `Left click`: shoot
- `iPhone/iPad`: left thumb move, right thumb aim, on-screen jump/fire buttons

## Objective Loop

Each stage has a clear goal:

1. Clear the drones in the arena.
2. Reveal the glowing star core.
3. Use the minimap to find and collect it.
4. Unlock the next stage.

## Deploy on Vercel

If the GitHub repo is already imported into Vercel, pushing to `main` should be enough.

Recommended Vercel settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables are required for this demo.
