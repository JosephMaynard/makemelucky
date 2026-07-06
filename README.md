# Make Me Lucky — V3

The internet's luck machine, rebuilt for 2026 as a real-time WebGL contraption.
Press the button, get lucky. [makemelucky.com](https://makemelucky.com)

Make Me Lucky is a hobby site built to fulfil the needs of hapless people
searching for luck on the internet — without trying to exploit them.

## What's in here

- **V3** (repo root) — Three.js scene: the classic green-quilted-leather Luck
  Machine rebuilt as procedural 3D. Six luck effects play in shuffled order
  (never the same twice in a row): Power Surge, Spin-Up, Rune Circle, Portal
  Drop, Cloud Tunnel and Star Burst. Installable offline PWA, cookieless
  PostHog analytics, Lucky Charms stored in localStorage (migrates the V2
  `luckStore`, so old presses still count).
- **public/v1** — the 2015 original (a button and a particle effect), preserved.
- **public/v2** — the 2016 Cinema 4D + jQuery/Velocity machine, preserved
  (ads and Google Analytics stripped from the archive).
- **makemelucky.com/** — untouched copy of the old Hostinger deployment,
  kept as the source of the archives.

## Development

```sh
pnpm install
pnpm dev        # local dev server
pnpm build      # production build → dist/ (includes /v1 and /v2)
```

All machine art is generated at runtime on canvas (`src/gfx/textures.js`) —
Celtic knotwork, quilted leather, glyph rings, particle sprites — so there are
no big image downloads and it stays sharp at any resolution. The only binary
assets are the licensed sound sprite, icons and fonts.

### Analytics

Set `VITE_POSTHOG_KEY` (and optionally `VITE_POSTHOG_HOST`) in the build
environment to enable PostHog. It runs with `persistence: 'memory'` — no
cookies, no banner. Without the key, analytics are a no-op.

### Visual test tools

```sh
node tools/snap.mjs <prefix> [effectName] [timesMsCsv] [--press]  # screenshot effects
node tools/pageshot.mjs <url> <out> [full]                        # screenshot a page
node tools/texdump.mjs <textureFn> <out> [size]                   # dump a generated texture
```

These drive the system Chrome via puppeteer-core against `pnpm dev` on port 5199.

## Credits

Created by Joseph Maynard. Sound effects licensed from AudioJungle.
Built with [three.js](https://threejs.org) and [Howler.js](https://howlerjs.com).
