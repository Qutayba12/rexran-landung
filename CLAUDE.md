# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

Rexran — the marketing site, checkout flow, client delivery portal, and admin
panel for an AI-directed ad studio serving DTC/Shopify brands (UGC video ads,
static creative, cinematic product films).

It is a **static multi-page Vite build plus Vercel Serverless Functions**. There
is no backend framework, no router library, no state manager, and no CSS
framework. Everything is deployed on Vercel.

## Commands

```bash
npm install
npm run dev      # Vite dev server — frontend only, api/ does NOT run
npm run build    # tsc -b && vite build — must pass before shipping
npm run lint     # eslint .
npm test         # vitest run
```

- **`api/*.js` do not run under `npm run dev`.** The Vite dev server only serves
  the frontend; every `fetch('/api/...')` will 404. Use `vercel dev` or a
  preview deploy to exercise the API.
- **`npm run lint` currently exits 1** on a pre-existing error in
  `src/analytics.ts:60` (`prefer-rest-params`, inside the TikTok pixel loader,
  which mirrors TikTok's vendor snippet). Do not treat this as a regression you
  introduced — but do not add new lint errors either. Verify by comparing
  against the same command on `main`.
- ESLint's flat config only applies rules to `**/*.{ts,tsx}`. **`api/*.js` is
  effectively unlinted** — hold it to the surrounding style by hand.
- `tsc -b` only type-checks `src/` (see `tsconfig.app.json`'s `include`).

## Architecture

### Frontend — multi-page build, four React roots

One Vite build produces many pages. There is no client-side router; each URL is
its own HTML document.

| Page | Shell | Entry | Root component |
| --- | --- | --- | --- |
| Marketing site `/` | `index.html` | `src/main.tsx` | `src/App.tsx` |
| Admin panel `/admin` | `admin.html` | `src/admin.tsx` | `src/AdminPage.tsx` |
| Client delivery `/delivery/:id` | `delivery.html` | `src/delivery.tsx` | `src/DeliveryPage.tsx` |
| Post-payment `/thank-you` | `thank-you.html` | `src/thankyou.tsx` | `src/ThankYouPage.tsx` |

Everything else — `studio.html`, `guides.html`, `privacy.html`, `terms.html`,
and each `guide-*.html` — is **plain static HTML** sharing `public/content.css`.
No React, no JS beyond two small bundled modules. Keep it that way: these pages
exist to be fast and indexable.

`src/App.tsx` (~1400 lines) holds the entire homepage plus the checkout modal.
`src/AdminPage.tsx` holds all six admin workspaces (`hub`, `videos`, `orders`,
`deliveries`, `testimonials`, `promos`) behind one password gate.

### Backend — `api/`, one file per endpoint

Standalone Vercel handlers, `export default async function handler(req, res)`.
No framework. Shared helpers live in `api/_lib/` (never routed — the underscore
keeps Vercel from treating them as functions).

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /api/videos` | public | Portfolio media for the homepage + studio hero |
| `GET /api/delivery?id=` | unguessable id | One client delivery's files |
| `GET /api/testimonials` | public | Approved testimonials |
| `GET /api/promo` | public | The one active store-wide promo |
| `GET /api/promo?code=` | rate-limited | Validate a customer-typed promo code |
| `POST /api/testimonials` | rate-limited *or* admin `action` | Client feedback submit **and** admin moderation |
| `POST /api/order` | rate-limited | Contact form → Telegram + email |
| `POST /api/checkout` | rate-limited | Create a Stripe Checkout session |
| `POST /api/customer-upload` | rate-limited | Presigned R2 PUT for customer reference photos (images only) |
| `POST /api/stripe-webhook` | Stripe signature | Payment confirmed → record + notify |
| `POST /api/promo` | admin password | Manage promos and promo codes |
| `POST /api/admin-videos` | admin password | Add/delete portfolio media |
| `POST /api/deliveries` | admin password | Create/list/delete client deliveries |
| `POST /api/orders` | admin password | List paid orders |
| `POST /api/upload` | admin password | Presigned R2 PUT for portfolio/delivery media |

> **`api/` holds exactly 12 function files, which is Vercel's Hobby-plan cap.**
> This is why `testimonials.js` and `promo.js` each serve both a public and an
> admin surface from one file, dispatching on `req.body.action`. **Do not add a
> 13th file in `api/`** — fold new behaviour into an existing handler with an
> `action` discriminator, the way those two do.

### Data — Upstash Redis

All state is a single JSON array per key, read-modify-written whole. There is no
schema and no migration story; be careful about field renames.

| Key | Written by | Shape |
| --- | --- | --- |
| `rexran:videos` | `admin-videos.js` | `{ id, url, type, poster }[]` |
| `rexran:deliveries` | `deliveries.js` | `{ id, client, note, files[], createdAt }[]` |
| `rexran:orders` | `stripe-webhook.js` | confirmed paid orders |
| `rexran:testimonials` | `testimonials.js` | `{ …, status: 'pending'\|'approved'\|'rejected' }[]` |
| `rexran:promos` | `promo.js` | store-wide promos (only one `active` at a time) |
| `rexran:promocodes` | `promo.js` | typed codes (many can be active) |
| `ratelimit:*`, `ratelimit:fail:*` | `_lib/rateLimit.js` | fixed-window counters |

### Media — Cloudflare R2, presigned direct upload

The browser never posts file bytes to our serverless functions (they'd hit the
body-size limit). Instead: the browser asks `/api/upload` (admin) or
`/api/customer-upload` (customer) for a short-lived presigned PUT url, uploads
straight to R2, and stores the returned permanent public url.

- Client half: `src/mediaUtils.ts` (`r2Upload`, `downscaleImage`,
  `makeVideoPoster`, `contentTypeFor`, `forceDownload`).
- Server half: `api/_lib/r2.js` (`presignPut`, `buildKey`, `toCdnUrl`).
- Key prefixes by purpose: `portfolio/`, `deliveries/`, `customer/`.
- **Always map stored urls through `toCdnUrl()` when reading them out of Redis.**
  Objects uploaded before the custom domain existed carry a slow `pub-*.r2.dev`
  host; `toCdnUrl` rewrites it to `R2_PUBLIC_BASE_URL` with no re-upload. Every
  read path (`videos.js`, `delivery.js`, `deliveries.js`, `orders.js`) already
  does this — new ones must too.
- Media hosting moved off Vercel Blob. `@vercel/blob` is still a dependency but
  no code path uses it; don't reintroduce it.

## Critical conventions

### 1. The server is the source of truth for money

`api/checkout.js` **recomputes the charge** from `api/_lib/pricing.js` and
applies discounts via `api/_lib/promo.js`. A client-sent `total` is display-only
and must never reach Stripe.

**`api/_lib/pricing.js` and the `SERVICES` / `PLANS` / `PLAN_CONTENTS` tables at
the top of `src/App.tsx` are two hand-maintained copies of the same price
table.** Change one and you must change the other, or the customer sees one
price and gets charged another. Same for `applyPromo()` in `src/App.tsx`, which
mirrors `applyPromoToTotal()` in `api/_lib/promo.js`. `api/_lib/pricing.test.js`
guards the server half; there is no test that cross-checks the two copies.

Discount rules: the customer gets the *better* of the active store-wide promo
and a typed code — never both stacked (`bestChargeTotal`). A `gift` promo is
announcement-only and never changes the price. The `MIN_ORDER` gate applies to
the pre-discount total.

### 2. Auth and abuse guards, on every protected handler

Admin endpoints all follow the same three-step opening, in this order:

```js
if (await isBlockedByFailedAttempts(req, 'admin', 10)) return res.status(429)…
if (!checkPassword(password, process.env.ADMIN_PASSWORD)) {
  await recordFailedAttempt(req, 'admin', 15 * 60)
  return res.status(401).json({ error: 'Unauthorized' })
}
```

`checkPassword` is constant-time (`api/_lib/auth.js`) — never compare with
`===`. The failure counter is shared across all admin endpoints and scoped by
IP, so 10 wrong passwords anywhere locks out all of them for 15 minutes. Public
write endpoints call `limitRequest(req, scope, limit, windowSeconds)` instead.

The admin password lives only in React state on `/admin` and is re-sent in every
request body. It is never persisted to `localStorage`/cookies — keep it that way.

### 3. CSP forbids inline scripts

`vercel.json` sets a strict `Content-Security-Policy` with `script-src 'self'`
plus an explicit allowlist. Consequences:

- Static HTML pages cannot use inline `<script>`. Anything they need ships as a
  bundled module: `src/studioHero.ts`, `src/analyticsBoot.ts`.
- Adding any third-party script (a pixel, a widget, a tag manager) **requires
  adding its host to `script-src` in `vercel.json`** or it silently fails to
  load. Currently allowed: `googletagmanager.com`, `connect.facebook.net`,
  `analytics.tiktok.com`.
- `src/analytics.ts` hand-ports the Meta and TikTok vendor snippets to avoid
  their inline/eval patterns. That's why the file looks unidiomatic.

### 4. Analytics is opt-in at build time, and the privacy page must track it

Vercel Web Analytics is always on (first-party, needs no ID). GA4, Meta Pixel,
and TikTok Pixel each stay entirely off — no script loads — unless
`VITE_GA_MEASUREMENT_ID` / `VITE_META_PIXEL_ID` / `VITE_TIKTOK_PIXEL_ID` is set.

`VITE_*` vars are **inlined by Vite at build time**. Setting one in Vercel does
nothing until a fresh deploy. Several commits in the history exist purely to
trigger that rebuild.

`privacy.html` enumerates exactly which trackers run. **If you turn a tracker on
or off, update `privacy.html` in the same change** — this is a disclosure
obligation, not a docs nicety, and ad-platform review depends on it.

Conversion events live in `src/analytics.ts`: `trackInitiateCheckout()` (fired
when the checkout modal opens) and `trackPurchase()` (fired once on return from
Stripe). Both are no-ops when no provider is configured.

### 5. Adding a page is a four-file change

1. Create the `.html` file at the repo root.
2. Add it to `build.rollupOptions.input` in `vite.config.ts` — **omit this and
   the page silently never gets built.**
3. Add a rewrite in `vercel.json` for the pretty URL.
4. Add it to `public/sitemap.xml` (and `public/robots.txt` if it must stay out
   of the index — `/admin` and `/delivery` are disallowed there).

For a static content page also link `/content.css` and
`<script type="module" src="/src/analyticsBoot.ts">`, and copy an existing
`guide-*.html` for the meta/OG/JSON-LD block.

### 6. Handler shape

Every handler: guard the method with a `405`, read `req.body || {}`, clamp every
string with `.slice(n)` before storing or forwarding it, wrap Redis/network work
in `try/catch`, and return `{ error, detail }` JSON — never throw. Notifications
(Telegram, Resend) are best-effort and must never fail the request. The Stripe
webhook is the one handler with `bodyParser: false` (raw body needed for
signature verification) and is idempotent by session id, because Stripe delivers
at least once.

## Order lifecycle

1. Customer picks a plan or builds a custom package in `src/App.tsx`, optionally
   uploading up to 6 reference photos (direct to R2 via `/api/customer-upload`).
2. `POST /api/checkout` recomputes the price, applies the best discount, and
   creates a Stripe Checkout Session. Photo urls ride along as
   `metadata[photo_1..6]` — one key each, because a single Stripe metadata value
   caps at 500 chars.
3. Customer pays on Stripe's hosted page. No card data touches this server.
4. `POST /api/stripe-webhook` verifies the signature, writes the order to
   `rexran:orders` (which is also the idempotency guard), and notifies Telegram
   + email.
5. Customer lands on `/thank-you?paid=1&session_id=…`; `trackPurchase` fires and
   the URL is cleaned so a refresh doesn't re-fire it.
6. Studio uploads finished files in the admin panel → a `delivery` record with an
   unguessable id → customer opens `/delivery/:id`.
7. From that page the customer can leave a rating/note. It is stored `pending`
   and appears nowhere until an admin approves it. **Testimonials on the site are
   always real and approved — never seed, invent, or hardcode one.**

## Style

- **Comments explain *why*, not *what*.** This codebase's comments are unusually
  dense and consistently justify a non-obvious decision (why constant-time
  compare, why a poster-first gallery, why an anchor click instead of
  `window.location.href`). Match that register; don't add narration.
- TypeScript in `src/`, plain ESM JavaScript in `api/`. No semicolons in `src/`
  or `api/`. Single quotes, 2-space indent, no Prettier config — follow the
  surrounding file.
- Design language is dark + gold, defined as CSS custom properties in
  `src/index.css` (`--bg`, `--gold`, `--ink`, `--display`/`--body`/`--mono`,
  `--r*` radii) and mirrored for static pages in `public/content.css`. Fonts:
  Fraunces (display), Manrope (body), JetBrains Mono. Use the tokens; don't
  hardcode hex values.
- CSS is hand-written per surface: `App.css` (homepage, largest), `admin.css`,
  `delivery.css`, `thankyou.css`, `public/content.css`.
- Motion is guarded: pointer-tracking tilt/glow effects sit behind
  `@media (hover: hover)` so touch never gets stuck mid-transform, and
  `prefers-reduced-motion` is honoured globally in `src/index.css` and per
  component (`usePrefersReducedMotion`).
- Media performance is deliberate: gallery videos are poster-first and
  tap-to-play (no bytes fetched until a tap), showcase images are downscaled in
  the browser before upload, and posters are auto-captured from a video's first
  frame. Don't regress this by autoplaying full clips.
- **Render purity is lint-enforced.** `eslint-plugin-react-hooks` v7 ships the
  React Compiler rules in its flat recommended config, so calling an impure
  function during render is an eslint *error* (there is no compiler transform in
  `vite.config.ts` — `react()` is unconfigured). Two patterns exist specifically
  for this: `Date.now()` is captured in a `useState` initializer rather than
  called during render, and navigation uses a synthesized `<a>` click instead of
  assigning `window.location.href`.

## Testing

Vitest, no config file, defaults only. Tests are colocated as
`api/_lib/*.test.js` and cover the pure logic that money and access depend on:
`pricing.test.js`, `promo.test.js`, `auth.test.js` (44 tests).

There are no component, DOM, or integration tests, and no test environment is
configured — **only add tests for pure functions unless you also set up jsdom.**
Any change to pricing, discount math, or password checking should come with a
test.

## Environment variables

`.env.example` documents every name (values live in Vercel → Settings →
Environment Variables). Never commit real secrets.

- Client, public, **build-time**: `VITE_GA_MEASUREMENT_ID`,
  `VITE_META_PIXEL_ID`, `VITE_TIKTOK_PIXEL_ID`.
- Server, secret: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`,
  `ADMIN_PASSWORD`, `RESEND_API_KEY`, `ORDER_EMAIL`, `ORDER_FROM`,
  `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

Handlers degrade rather than crash when optional config is missing: no
`RESEND_API_KEY` skips email, no R2 config returns a clear 500 from the upload
endpoints, an unreachable promo store charges full price.

## Git workflow

- Work on the branch you were assigned; never push to `main` directly.
- Commit subjects are sentence case, often area-prefixed, describing the
  user-visible outcome: `Pricing UI: fix Growth name hidden by badge`,
  `Work gallery: poster-first, tap-to-play videos (instant load, no autoplay)`.
  No Conventional Commits. The `(#NN)` suffix is appended by GitHub's squash
  merge — don't write it yourself.
- Bodies explain the reasoning and any operational consequence (e.g. "this also
  triggers a rebuild so the pixel env var is baked in").
- Commits are `Co-authored-by: Claude <noreply@anthropic.com>`.
- Never put a model name or identifier in a commit message, PR, or code comment.

## Gotchas

- **`README.md` is partly stale.** It still describes Vercel Blob as the file
  store (it's Cloudflare R2 now) and lists a `POST /api/admin-testimonials`
  route that does not exist (moderation merged into `POST /api/testimonials`).
  Trust the code and this file over it.
- `guide-*.html` files duplicate their nav/footer markup. Editing site-wide
  chrome means touching each of them.
- `src/App.css` is ~880 dense lines; search for the class name rather than
  reading top-to-bottom.
- `.claude/skills/` contains vendored design skills (brand, design-system,
  frontend-design, ui-styling, ui-ux-pro-max, banner-design, slides). They are
  tooling, not application code — don't refactor them.
- The Stripe webhook returns diagnostic detail on signature failure
  (`hasSecret`, an 8-char secret prefix, body length). It leaks no secret, and
  it's there to explain 400s in Stripe's dashboard logs — leave it.
