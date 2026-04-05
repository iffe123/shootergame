# Neon Siege

A lightweight first-person shooter demo for the browser, built from scratch with Three.js and Vite.

## What it shows

- First person mouse look with pointer lock
- WASD movement and jumping
- Click-to-shoot enemy drones
- Wave progression, health, score, and HUD
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

## Deploy on Vercel

If the GitHub repo is already imported into Vercel, pushing to `main` should be enough.

Recommended Vercel settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

No environment variables are required for this demo.
