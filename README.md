# Cocktail Shaker

> A virtual bartender that lives behind a QR code at a bar table.

**[Live demo →](https://cocktail-shaker-app.mr-csongor-nagy.workers.dev)**

Customers scan a QR code, answer three bartender-style questions, and get a personalised cocktail recommendation. They then "make" their drink using the phone's motion sensors — shaking the device to mix, tilting to pour. Phase 1 of a hospitality SaaS platform.

---

## How it works

1. **Answer three questions** — spirit, flavour profile, vibe. The bartender recommends a cocktail from a menu of 20.
2. **Fill the shaker** — ingredients animate into the shaker automatically.
3. **Shake** — the phone detects real shaking motion. Shake hard enough for long enough to unlock the pour.
4. **Swipe up to remove the lid**, then **tilt to pour** — the phone's orientation sensor drives the liquid animation in real time.
5. **Share your drink** — native iOS share sheet exports a canvas snapshot with the cocktail name overlaid. Save to Photos, AirDrop, iMessage.

All interaction is physical. No buttons during the shaking and pouring phases — the phone is the shaker.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla JS, HTML Canvas, CSS — no framework |
| Motion sensors | `DeviceMotionEvent` + `DeviceOrientationEvent` (iOS 13+ permission flow) |
| Backend | Python, Flask, SQLAlchemy |
| Database | PostgreSQL on Supabase |
| Frontend hosting | Cloudflare Workers (static assets + API proxy) |
| Backend hosting | Render |
| PWA | Service worker, `manifest.json`, portrait-locked, installable |

---

## Architecture

### State machine

The app is a pure state machine. `engine.js` owns all transitions — no state bleeds into another's rendering or update logic.

```
WELCOME → QUESTIONING → RESULT → FILLING → SEALED → SHAKING → STILL → POURING → DONE
                                 ↓ (permission denied)
                          PERMISSION_DENIED
```

### Sensor pipeline

Ported from [TiltJump](https://github.com/EgoAlter/tiltjump) and extended with pour detection.

- **Shake** — `DeviceMotionEvent` acceleration magnitude, spike-counted with a 300ms cooldown. Transition to STILL requires 8 shakes AND 2 seconds of sustained shaking — prevents taps and fumbles triggering the state change.
- **Pour** — `gamma` axis (left-right rotation). Phone upright = 0°, wrist rotating anti-clockwise = negative gamma toward −90°. Mapped to pour progress 0 → 1 with EMA smoothing. No calibration offset — physical vertical is the pour reference, not the user's held position.

### Cocktail selector

Tag-based scoring, not if-else chains. Each cocktail has CSV tags (`vodka,fruity,classic`). The selector hard-filters on spirit first, then scores the filtered pool on flavour + style. "Surprise me" skips the spirit filter but still scores on taste preference. Scales to a real 30+ cocktail menu without producing nonsense results.

### API proxy

The Cloudflare Worker intercepts `/api/*` and proxies to the Render backend via a `RENDER_API_URL` secret — the frontend uses relative URLs throughout, no CORS headers needed.

### Export

`navigator.share({ files: [file] })` surfaces the native iOS share sheet (save to Photos, AirDrop). Canvas name overlay is drawn on an offscreen clone so the visible canvas is not mutated. Synchronous `atob()` Blob conversion keeps the share call within the user gesture tick — iOS Safari requires this.

---

## Local development

### Prerequisites

- Python 3.11+
- Node.js 20+ (for wrangler deploys)
- A [Supabase](https://supabase.com) project with the connection string
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for the HTTPS tunnel (required for iOS motion sensor permissions)

### Setup

```bash
git clone https://github.com/EgoAlter/cocktail-shaker-app
cd cocktail-shaker-app

# Python environment
cd api
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Create api/.env
echo "DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" > .env

# Seed the database (run once)
venv/bin/python seed.py

# Start the API on :5001
venv/bin/python app.py
```

```bash
# Second terminal — serve the frontend on :8765
python3 -m http.server 8765 --directory public
```

```bash
# Third terminal — HTTPS tunnel for iOS sensor permissions
cloudflared tunnel --url http://localhost:8765
# Open the HTTPS URL in Safari on iPhone
```

### Deploying changes

```bash
# Redeploy frontend + worker to Cloudflare
npx wrangler deploy

# The RENDER_API_URL secret persists across deploys — no need to re-set it.
# To set it for the first time: npx wrangler@4.86.0 secret put RENDER_API_URL
```

Render auto-deploys the backend from the `main` branch via GitHub integration.

---

## Project structure

```
cocktail-shaker/
├── worker.js               # Cloudflare Worker — API proxy + static asset fallback
├── wrangler.toml           # Cloudflare Workers config (assets served from public/)
├── render.yaml             # Render service definition
│
├── public/                 # All static frontend assets (served by Cloudflare Workers)
│   ├── index.html          # Shell — manifest, SW registration, canvas mount
│   ├── manifest.json       # PWA: standalone, portrait, icons
│   ├── sw.js               # Service worker — cache-first static, network-only API
│   ├── app.js              # Entry point — font load, canvas sizing, engine init
│   │
│   ├── game/
│   │   ├── engine.js       # State machine + rAF game loop
│   │   ├── sensors.js      # All sensor logic — shake, pour, tilt, still detection
│   │   └── renderer.js     # Canvas drawing — no logic, pure visual output
│   │
│   ├── bartender/
│   │   ├── questionnaire.js  # Q&A state machine
│   │   ├── selector.js       # Spirit hard-filter + flavour/style tag scoring
│   │   └── questions.js      # Question and answer data (decoupled from logic)
│   │
│   ├── shaker/
│   │   ├── animation.js    # All canvas animation — placeholder shapes, replaceable
│   │   └── export.js       # Web Share API export with canvas name overlay
│   │
│   └── ui/
│       ├── screens.js      # Full-screen HTML overlays — welcome, Q&A, result, done
│       └── hud.js          # In-game HUD — shake meter, pour progress
│
└── api/
    ├── app.py              # Flask — REST API + static file serving fallback
    ├── models.py           # SQLAlchemy Cocktail model
    ├── seed.py             # 20-cocktail seed dataset
    └── requirements.txt    # Pinned Python dependencies
```

---

## Roadmap

This is Phase 1 of a hospitality SaaS platform.

**Phase 1 — Interactive bartender** *(complete)*
- Motion-sensor shaker game mechanic on iPhone via PWA
- Personalised cocktail recommendation from a 20-drink menu
- Share cocktail image via native iOS share sheet
- Deployed: Cloudflare Workers + Render + Supabase

**Phase 2 — Venue platform**
- Payment integration (Tabology API or Stripe)
- Bar printer trigger on confirmed order
- Real visual assets (pixel art or AI-generated sprites)
- Admin UI for menu management — add/edit cocktails without code
- Session analytics — which cocktails are ordered, at which tables

**Phase 3 — SaaS**
- Multi-venue support with per-venue menus and branding
- Venue website builder with embedded shaker widget
- Delivery ecommerce integration
- Subscription tiers — free QR demo, paid order processing

---

## Background

Built as a proof-of-concept for a hospitality venue product and as a personal project to go deeper on browser motion sensors, PWA architecture, and full-stack JS + Python development.

The sensor foundation is ported from [TiltJump](https://github.com/EgoAlter/tiltjump), a previous motion-sensor browser game. Cocktail Shaker extends it with pour detection, a full state machine, a Flask + PostgreSQL backend, and a complete product flow from question to shareable result.

Built with AI-assisted development using [Claude Code](https://claude.ai/code).

---

## License

MIT
