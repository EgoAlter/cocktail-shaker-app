# Cocktail Shaker PWA — CLAUDE.md

## What this project is

An interactive hospitality PWA — a virtual bartender that lives behind a QR code at a bar table. Customers answer a short set of bartender-style questions to get a personalised cocktail recommendation, then "make" their drink via a physical shaking and tilting interaction using the phone's motion sensors.

**This is not a standalone toy.** It is Phase 1 of a hospitality SaaS arc:
- Phase 1 (this project): interactive bartender + shaker game mechanic
- Phase 2: payment integration (Tabology backend, bar printer trigger)
- Phase 3: venue website, delivery ecommerce, full hospitality ecosystem

Build with that in mind. Every decision should survive Phase 2 without a rewrite.

## Developer context

- **Developer:** Jake — BSc Biochemistry, 10 years hospitality ops, self-taught dev
- **Primary device:** iPhone 12 Mini (Safari PWA, portrait)
- **Dev machine:** MacBook Pro Early 2015, macOS, VSCode, Python 3, GitHub
- **Methodology:** AI-assisted development is an accepted working style
- **Stack:** Vanilla JS + HTML Canvas + CSS (frontend) / Python Flask + PostgreSQL via SQLAlchemy (backend, hosted on Supabase)
- **Sensor foundation:** Already proven in TiltJump (github.com/EgoAlter/tiltjump)

## Session startup checklist

1. Read this file in full
2. Run `ls -R` to check current file structure
3. Run `git log --oneline -10` to see what was done last session
4. Ask Jake what the session goal is before writing any code
5. Name the architectural decision before implementing it
6. If touching `sensors.js`, explain the sensor concept before writing the function

## Architecture overview

```
cocktail-shaker/
├── index.html              # Shell — manifest, SW registration, canvas mount
├── manifest.json           # PWA: standalone, portrait, icons
├── sw.js                   # Service worker — cache-first for all static assets
├── app.js                  # Entry point — font load, canvas size, engine init
│
├── game/
│   ├── engine.js           # State machine + game loop (rAF)
│   ├── sensors.js          # ALL sensor logic — ported from TiltJump, extended
│   ├── renderer.js         # Canvas drawing — no logic, pure visual output
│   └── score.js            # (placeholder — may repurpose for session tracking)
│
├── bartender/
│   ├── questionnaire.js    # Question flow logic — state machine of Q&A steps
│   ├── selector.js         # Maps answers → cocktail from database
│   └── questions.js        # Question + answer data (decoupled from logic)
│
├── shaker/
│   ├── shaker.js           # Shaker game state machine (idle→filling→sealed→shaking→pouring→done)
│   ├── animation.js        # All canvas animation — ingredients, liquid, pour effect
│   └── export.js           # Canvas snapshot → downloadable PNG with cocktail name
│
├── api/
│   ├── app.py              # Flask app — serves cocktail data via REST
│   ├── models.py           # SQLAlchemy Cocktail model
│   ├── seed.py             # Dummy dataset seeder — run once to populate DB
│   └── cocktails.db        # SQLite database (gitignored in production, seeded in dev)
│
├── ui/
│   ├── screens.js          # Full-screen overlays — welcome, question, result, done
│   └── hud.js              # In-shaker HUD — shake intensity meter, pour progress
│
└── assets/
    ├── icons/              # PWA icons — 192×192 and 512×512
    └── sounds/             # Optional — pop, pour, shake SFX (keep small, optional)
```

## State machine — top level

```
WELCOME → QUESTIONING → RESULT → FILLING → SEALED → SHAKING → STILL → POURING → DONE
                                 ↓ (permission denied)
                          PERMISSION_DENIED
```

Each state is a distinct UI and logic mode. The engine.js state machine owns transitions. No state should bleed into another's rendering or update logic.

### State descriptions

| State | What's happening |
|---|---|
| `WELCOME` | Splash screen — brand, tap to start |
| `QUESTIONING` | Bartender Q&A — 3 questions, logic-gated |
| `RESULT` | Cocktail revealed — name, short description, "Make it?" CTA |
| `FILLING` | Animated ingredients drop into shaker (canvas animation, no input) |
| `SEALED` | Lid snaps on — prompt to allow device motion + shake |
| `SHAKING` | Player shakes phone — shake intensity visualised |
| `STILL` | Device stationary — tap to remove lid |
| `POURING` | Player tilts to pour — liquid fills glass |
| `DONE` | Cocktail shown in glass — download + (future) order options |

## sensors.js — design contract

Ported directly from TiltJump. Extended with pour detection. Do not break the existing API.

```js
// Inherited from TiltJump — unchanged
SensorManager.requestPermission()   // iOS 13+ gate — call from inside tap handler
SensorManager.startOrientation()    // DeviceOrientationEvent listener
SensorManager.startMotion()         // DeviceMotionEvent listener
SensorManager.calibrate()           // Capture current gamma as zero reference
SensorManager.getTilt()             // Smoothed calibrated tilt: −1 to +1 (left/right)
SensorManager.onShake(callback)     // Shake callback — callback(magnitude)
SensorManager.isStill(ms)           // True if no significant motion in last N ms
SensorManager.stop()                // Remove all listeners cleanly

// New for this project
SensorManager.getPour()             // Returns 0.0–1.0 pour progress based on gamma tilt
SensorManager.onStill(ms, callback) // Fires callback once device has been still for ms
SensorManager.isShakingLongEnough() // True if sustained shaking >= _minShakeDurationMs (2000ms)
```

**Pour detection uses `gamma`** (left-right rotation axis), not beta. In portrait, phone upright = gamma ≈ 0°. Rotating anti-clockwise (left edge down — the natural pouring gesture holding a shaker in the right hand) = gamma goes negative toward −90°. `getPour()` maps 0° → −90° to progress 0 → 1. Raw gamma is smoothed separately as `_smoothedGamma` (no calibration offset — physical vertical is the pour reference, not the user's initial held position).

Smoothing: same EMA pattern as TiltJump. `smoothed = α × raw + (1−α) × smoothed`

## bartender/ — design contract

The Q&A flow is a simple decision tree, not AI-generated. Each question narrows the cocktail pool by tag matching.

```js
// questions.js — data only
export const QUESTIONS = [
  {
    id: 'spirit',
    text: "What's your spirit?",
    options: ['Vodka', 'Rum', 'Whiskey', 'Gin', 'Tequila', 'Surprise me'],
  },
  {
    id: 'flavour',
    text: 'How do you like it?',
    options: ['Sweet', 'Fruity', 'Sour', 'Bitter', 'Balanced'],
  },
  {
    id: 'style',
    text: 'What's your vibe?',
    options: ['Classic', 'Fancy', 'Quirky', 'Strong & simple'],
  },
];

// selector.js — maps answers object to a cocktail
selectCocktail({ spirit, flavour, style }) → Cocktail | null
```

The selector uses tag scoring, not if-else chains. Each cocktail in the DB has tags (`['vodka', 'fruity', 'classic']`). The selector scores all cocktails by how many tags match the answers and returns the highest scorer. This is the architecture that survives real menus with 30+ cocktails.

## api/ — Flask backend

Minimal REST API. Frontend fetches cocktail data; all game logic stays in JS.

```
GET /api/cocktails          → all cocktails (for selector)
GET /api/cocktails/:id      → single cocktail detail
GET /api/health             → { status: 'ok' } — tunnel sanity check
```

The frontend fetches the full cocktail list once on load and caches it in memory. No per-question API calls — all filtering happens client-side in selector.js.

### Database: Supabase (Postgres)

**Decision (Phase 1B):** Postgres via Supabase, not SQLite.

SQLite was the Phase 1A placeholder. Switched because:
- Render's SQLite is ephemeral — wiped on cold start. Any bar owner editing the menu loses data.
- Supabase free tier includes a built-in table editor — free admin UI for menu management without Phase 2 work.
- Supabase's auto-REST (PostgREST) is a future shortcut if the Flask API needs to be bypassed.

Connection string is set via `DATABASE_URL` environment variable. Never hardcoded.

```bash
# Local dev: copy api/.env.example → api/.env and fill in your Supabase URL
# .env is gitignored — never commit credentials

# Get connection string from:
# Supabase project → Settings → Database → Connection string → URI (Session mode, port 5432)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Falls back to local SQLite when `DATABASE_URL` is not set (prints a warning). Use SQLite only for quick local smoke tests — always point to Supabase for real data.

## animation.js — visual design contract

**Phase 1 visual style: placeholder shapes.** Functional, not beautiful. Each element is a named, replaceable function — swap in real assets later without touching game logic.

```js
drawShaker(ctx, state)          // Chunky rectangle shaker body + lid
drawIngredient(ctx, ingredient) // Coloured circle falling into shaker
drawLiquid(ctx, fillLevel)      // Coloured rectangle rising in shaker (0–1)
drawPour(ctx, progress)         // Arc of liquid from shaker to glass
drawGlass(ctx, fillLevel)       // Classic martini/rocks glass outline + fill
drawShakeEffect(ctx, intensity) // Screen shake / particle burst during shaking
```

WHY this separation: when real assets arrive (pixel art, SVG, AI-generated sprites), each function is swapped independently. The game state machine calls the same function names regardless of what's inside them.

## Deployment during development

```bash
# Flask backend
cd api && python app.py          # Runs on :5001

# Static frontend (serve from project root)
python3 -m http.server 8765      # Runs on :8765

# iPhone tunnel — HTTPS required for iOS sensor permissions
cloudflared tunnel --url http://localhost:8765
# Opens HTTPS URL — open in Safari on iPhone
```

Database: PostgreSQL on Supabase. The Flask app connects via DATABASE_URL environment variable.
Use the session pooler connection string from the Supabase dashboard (not the direct connection) —
the Asia-Pacific region requires this due to IPv6 constraints.

For full-stack dev, the frontend fetches `/api/*` from the tunnel URL. Flask runs on :5001 with
CORS enabled. The DB is always remote (Supabase) — no local DB to start or migrate during dev.

**Cloudflare Workers deployment** (same as TiltJump): `wrangler deploy` from project root.

## Conventional commits

```
feat: add shake detection to sensors.js
fix: pour progress clamped at 1.0
chore: seed dummy cocktail data
refactor: extract animation functions to animation.js
```

## Database schema — Cocktail model

```python
class Cocktail(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(200))
    tags        = db.Column(db.String(200))  # CSV: 'vodka,fruity,classic'
    ingredients = db.Column(db.Text)         # JSON array stored as text
    colour      = db.Column(db.String(20))   # Hex — used for placeholder animation
```

Tags are stored as CSV and parsed at runtime. This is simple enough for Phase 1 and replaceable with a proper many-to-many join table in Phase 2.

**Database:** PostgreSQL hosted on Supabase. Connection uses the session pooler (not direct connection) — required because the Supabase Asia-Pacific region does not support IPv6 on direct connections. Connection string is stored in an environment variable (DATABASE_URL). Never hardcode credentials.

`ingredients` is stored as a JSON string (`'["Gin","Campari"]'`) and parsed back to a list in `to_dict()`. The API always returns an array, never a raw string.

Seed the DB with `cd api && venv/bin/python seed.py`. Re-running clears and re-seeds cleanly.

## Environment variables

```
DATABASE_URL=<Supabase session pooler connection string>
```

Store in a `.env` file at the project root (gitignored). Load in `api/app.py` via `python-dotenv`.
Never commit credentials. The session pooler URL format from Supabase looks like:
`postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

## PWA requirements

- `manifest.json`: `display: standalone`, `orientation: portrait`, icons at 192 and 512
- `sw.js`: cache-first for all static assets; network-only for `/api/*`
- iOS meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`
- `touch-action: none` on canvas to prevent scroll hijack

## What NOT to do

- Do not use React, Vue, or any JS framework
- Do not use a physics engine or animation library — implement manually
- Do not skip the iOS 13+ sensor permission flow
- Do not hardcode canvas dimensions — always derive from `window.innerWidth/Height`
- Do not use `alert()` — all UI is canvas or HTML overlay
- Do not break the `SensorManager` API contract
- Do not make per-question API calls — fetch the full cocktail list once
- Do not mix game logic into `renderer.js` or `animation.js` — those are pure visual output

## Build order (phases)

### Phase 1A — Skeleton + testable deploy
- `index.html`, `manifest.json`, `sw.js`, `app.js` scaffolded
- Canvas fills viewport, font loads, SW registers
- Cloudflare tunnel live — testable on iPhone before any features exist

### Phase 1B — Database + API
- Flask app, SQLAlchemy model, seed script
- `GET /api/cocktails` returns dummy data
- Tested via curl and browser before wiring to frontend

### Phase 1C — Bartender flow
- Question screens rendered on canvas
- Selector logic maps answers to a cocktail
- Result screen shows cocktail name + description
- Fully testable with keyboard/tap before sensors are involved

### Phase 1D — Shaker MVP
- Sensor permission flow (reused from TiltJump)
- Filling animation (placeholder shapes)
- Shake detection → shaking state → still detection
- Pour detection → glass fill animation
- Done screen with cocktail display

### Phase 1E — Export
- Canvas snapshot → PNG download
- Cocktail name overlaid on image

### Phase 2 (future)
- Payment integration (Tabology API or Stripe)
- Real visual assets (pixel art or AI-generated sprites)
- Sound effects
- Admin UI for menu management

## Current phase

**Phase 1A — COMPLETE.** Skeleton, canvas, SW, tunnel confirmed on iPhone.
**Phase 1B — COMPLETE.** PostgreSQL on Supabase via SQLAlchemy. Models active, seed data in DB, all three API endpoints verified.
**Phase 1C — COMPLETE.** HTML overlay Q&A, single fetch on load, client-side selector, result screen with "Make it →" and "Start over" CTAs. Engine transitions to FILLING on "Make it →".
**Phase 1D — COMPLETE.** Full shaker arc working and phone-tested. Animation layout polished on `fix/shaker-animation-layout` (merged to main 2026-06-01): shaker/glass self-centring layout, ingredient drop clipping, swipe-up lid removal with real-time finger tracking, tilt-driven shaker rotation, pour stream from rotated lip straight down to liquid surface, glass transition animation from pour position to done screen.
**Next — Sensor fixes.** Motion and tilt sensor behaviour needs a dedicated branch. Start session by reading this file, running `git log --oneline -10`, and asking Jake what specific sensor issues to fix before writing any code.

## Branch discipline

- main is always clean and phone-testable
- Never commit directly to main
- One fix or feature per branch, named fix/ or feat/
- Branch from main, merge back to main only after phone testing confirms it works
- graveyard/batch-debug preserves all previous batch fix attempts for reference
