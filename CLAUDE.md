# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal closet management web application — a visual wardrobe inventory, admin tool, AI styling assistant, and item card generator. **No build system.** Pure static HTML + CSS + JS + JSON. Open files directly in a browser or serve locally with `python3 -m http.server`.

---

## Deployment Topology

```
GitHub repo (krknecht/my-closet)
  └── Cloudflare Pages → my-closet.pages.dev  (also: doesthislookright.com, same project, custom domain)
        └── Serves: all HTML, closet.json, style-profile.json, image files, font TTFs

Files for Claude Code/worker.js
  └── Deployed separately as Cloudflare Worker → closet-proxy.doesthislookright.workers.dev
        Proxies:
          GET/PUT /proxy/contents/{path}  →  GitHub Contents API (reads/writes files to the repo)
          GET     /proxy/image?url=       →  External URL → base64 (for Anthropic vision API)
          POST    /proxy/anthropic        →  Anthropic Messages API (uses env.ANTHROPIC_API_KEY)
```

**Worker auth:** Origin allowlist only — no passphrase, no Cloudflare Access on the worker itself. Requests from origins not in `ALLOWED_ORIGINS` get a 403. The Pages site (`doesthislookright.com`) IS behind Cloudflare Access; the worker is not.

**Worker secrets** (set via `wrangler secret put`, not in wrangler.toml):
- `ANTHROPIC_API_KEY` — used server-side for all AI calls
- `GITHUB_TOKEN` — PAT with `repo` scope for Contents API writes

**Note:** `wrangler.toml` still contains a stale comment referencing `CLOSET_PASSPHRASE` — that secret was removed when passphrase auth was replaced with the origin allowlist. It's no longer used.

---

## The Four Tools

| File | What it does |
|------|-------------|
| `index.html` | Public read-only gallery — filters, search, and a slide-in detail drawer. Fetches `closet.json` from `my-closet.pages.dev`. |
| `closet-manager.html` | 3-panel admin editor — browse items, fill a form, preview JSON, then save to GitHub via the Worker. Also handles image upload. |
| `style-assistant.html` | AI chat interface backed by Claude. Sends closet metadata + base64 images to the Anthropic API via Worker. Conducts style-profile interview and persists result in `localStorage` and optionally to `style-profile.json` in the repo. |
| `item-card-generator-v3.html` | Standalone tool for creating item cards from URLs, photos, or manual entry. Uses its own internal item model — not directly connected to `closet.json`. |

---

## Data Files

### `closet.json` — single source of truth for the wardrobe
- UUID-keyed. Two top-level arrays: `items` and `outfits`.
- `schema_updated` at the top is a date string. Bump it when you change the schema (field additions, removals, or vocabulary changes) — not on every data edit.
- Read by: `index.html`, `closet-manager.html`, `style-assistant.html` (all fetch it live from `my-closet.pages.dev`).
- Written by: `closet-manager.html` (via Worker → GitHub Contents API).

### `style-profile.json` — user's style profile
- Written by `style-assistant.html` after completing the onboarding interview. Stored in `localStorage` first; user can optionally push to the repo via the Worker.
- Not consumed by any other tool currently.

---

## Image Handling

### Where images live
All item images are UUID-named files at the **repo root** (e.g., `4dde8c42-…jpg`). Served directly by Cloudflare Pages at `https://my-closet.pages.dev/{filename}`. No subdirectory, no CDN, no R2 (yet).

Three empty placeholder directories exist at repo root: `Outfits/`, `Selfies/`, `Style Inspiration/`. These are empty — intended for future use.

### The `image` field in closet.json
```json
"image": {
  "filename": "4dde8c42-4838-4122-8a95-fb4aa8f16e41.jpg",
  "format":   "jpg",
  "public_url": "https://my-closet.pages.dev/4dde8c42-4838-4122-8a95-fb4aa8f16e41.jpg",
  "alt_images": []
}
```

**`image.filename` is the source of truth.** `image.public_url` is a redundant denormalization — always `https://my-closet.pages.dev/{filename}`, always derivable. It is written by `closet-manager.html` at save time (line 571: `public_url:'https://my-closet.pages.dev/'+fn`). A future cleanup should remove `public_url` from the schema entirely.

`public_url` caused a production bug: when it was missing from deployed data (closet.json had `filename` but not `public_url`), the gallery showed emoji placeholders for every item. The fix was to derive the URL from `filename` in `index.html` rather than read `public_url`. **Do not add new code that depends on `public_url` being present.**

### How each tool currently constructs image URLs (known inconsistency)

| Tool | Code | Pattern |
|------|------|---------|
| `index.html` | lines 272, 290 | `'https://my-closet.pages.dev/' + item.image.filename` |
| `closet-manager.html` | line 395, 641 | `img.src = item.image.filename` (bare relative path — works because the HTML is served from the same Pages origin) |
| `style-assistant.html` | line 646 | reads `item.image.public_url`, fetches through Worker proxy for base64 |
| `item-card-generator-v3.html` | uses own `item.imageFilename` | not connected to closet.json; relative path only |

This inconsistency is known and slated for cleanup. Do not introduce a fifth pattern.

### Image upload atomicity problem
In `closet-manager.html`, `saveItem()` pushes the image file to GitHub and then pushes updated `closet.json` as two separate, independent operations. If the image push fails (network error, GitHub API timeout) but the closet.json write succeeds, the item record exists with a `filename` that has no file behind it. **This has happened in production.** Until the fix lands (make image push a prerequisite for metadata save, abort on failure), assume that not every item with a `filename` in closet.json has a file in the repo.

---

## `Files for Claude Code/`

This directory contains the Cloudflare Worker source:
- `worker.js` — the Worker code, deployed to `closet-proxy.doesthislookright.workers.dev`
- `wrangler.toml` — Worker config (`name = "closet-proxy"`, `GITHUB_OWNER`, `GITHUB_REPO`)

**It is not served by Cloudflare Pages.** It exists in the repo for version control only. Deploying the worker requires `wrangler deploy` run from inside this directory (or configured in Cloudflare dashboard). Do not confuse it with the app's HTML/JS code.

---

## Design System

CSS custom properties defined at `:root` in each HTML file. Key tokens:
- **Ink** `#1c1917`, **Paper** `#faf9f7`, **Accent** (sage green) `#2d4a2d` / `#4a7c4a`
- **Header**: `background: #000`, white text, inverted active nav tab (white pill)
- **Typography**: `Vend Sans` variable font (`font-weight: 100 900`), loaded via local `@font-face` from `VendSans-VariableFont_wght.ttf` and `VendSans-Italic-VariableFont_wght.ttf` at repo root. Some closet-manager.html CSS still references `Cormorant Garamond` and `DM Mono` as fallbacks in a few isolated selectors, but Vend Sans is the site-wide typeface.
- **Nav**: Gallery and Style Assistant tabs appear on `index.html` and `style-assistant.html`. Generator tab appears only on `item-card-generator-v3.html`. Closet Manager has a standalone header (back link only, no tabs).

---

## Taxonomy & Controlled Vocabularies

See `closet-spec-v1.md` for the full schema. Key enums to not invent new values for:
- **Departments**: Clothing, Shoes, Bags, Accessories, Jewelry, Activewear, Swimwear, Lingerie & Loungewear
- **Formality**: integer 1–10
- **Pattern**, **fabric weight**, **silhouette**, **seasons**, **sustainability**, **sleeve_length**, **length** — all defined in spec

Adding a new department requires updating `closet-spec-v1.md` AND any hardcoded filter/render logic in the HTML files.

---

## Known Gotchas

- **Local repo ≠ GitHub repo for images.** Images are pushed to GitHub directly via the Worker (no local `git add`). Your local clone will be missing image files that were uploaded via the closet manager. Don't assume a file that's in `closet.json` exists in your local working copy.

- **`credentials: 'include'` was removed** from all worker fetches. The worker uses origin allowlist auth now. If you're adding a new `fetch()` call to the worker, do NOT add `credentials: 'include'` — it's no longer relevant and was causing CORS errors with the `*` wildcard.

- **`Files for Claude Code/` is not deployed by Pages.** The working app code is at repo root. Editing worker code here has no effect until `wrangler deploy` is run.

- **The closet manager does not update `index.html`.** At one point it did (auto-generated and pushed `index.html` on every save). That code was removed. `index.html` is hand-maintained.

- **`item-card-generator-v3.html` has its own item model**, separate from the closet.json schema. Items generated there are not automatically added to `closet.json` — that's a manual step.

- **`public_url` is written by closet-manager but should not be read by new code.** `style-assistant.html` currently reads it (line 646); that's a known inconsistency. Use `filename` + derived URL everywhere else.

---

## Tried and Rejected

- **`public_url` as a read field**: Caused a production outage (emoji placeholders site-wide) when deployed `closet.json` had `filename` but no `public_url`. Reverted in commit `d91390f`. Derive URLs from `filename` instead.

- **Client-side credential storage** (Anthropic API key + worker passphrase in `localStorage`): Replaced with worker secrets (`env.ANTHROPIC_API_KEY`) + origin allowlist. No credentials flow through the browser.

- **Cloudflare Access on the Worker**: Attempted but reverted. The Pages site is behind Access; the Worker uses origin allowlist only.

- **AVIF images**: Anthropic's vision API does not accept `image/avif`. Three items had avif images that were replaced with JPGs (commit `6b2020c`). Do not add avif files; use jpg, png, or webp.

- **Google Fonts** (Cormorant Garamond + DM Mono): Replaced with Vend Sans variable font loaded from local TTF files (commit `f6c82c0`).

- **Closet manager auto-pushing `index.html`**: Removed (commit `cddffe4`). The manager was overwriting the hand-crafted gallery on every item save.

---

## Commit Message Convention

Git history uses inconsistent styles (mix of imperative sentences, "Fix:", "feat:" prefixes, and Closet-Manager-generated messages). Proposed convention going forward:

```
type(scope): description

Types: fix | feat | chore | docs | refactor
Scope: gallery | manager | assistant | generator | worker | schema | data
```

Examples: `fix(gallery): derive image URLs from filename`, `feat(assistant): add style profile interview`, `chore(worker): simplify origin allowlist auth`

---

## Open Questions

- **Saint Laurent black blazer missing in gallery** (item `3cd4416a`, colorway "Black"): The jpg file exists in the local repo (1.0 MB, committed in `6b2020c`). Both Saint Laurent blazers are `status: active`. The gallery constructs the URL as `https://my-closet.pages.dev/3cd4416a-d88a-41d3-bb60-74bbd31d9d5d.jpg`. Root cause of broken image not yet identified — start by checking whether the file is actually present in the deployed Pages build (could be a Pages cache or deployment issue) and whether there's something in the item's data that causes it to be filtered out of the render.

- **10 of 16 items have no image file in the local repo** (files exist in closet.json but not locally). These may exist in the GitHub repo (pushed via Worker from closet manager) without having been pulled locally. Or they may be genuinely missing (atomicity bug, above). Verify by checking the GitHub repo directly.

- **`style-assistant.html` reads `image.public_url`** (line 646) while `index.html` derives from `filename`. These should be made consistent; `style-assistant` should be updated to use the derived URL or fall back gracefully when `public_url` is absent.

---

## See Also

- **`closet-spec-v1.md`** — Canonical data schema and full controlled-vocabulary lists. Read before editing the data model, adding enum values, or changing field names.
- **`closet.json`** — Live wardrobe data. `schema_updated` field at top should be bumped when schema changes.
- **`style-profile.json`** — User's style profile (generated by style-assistant interview). Not consumed by other tools yet.
- **`Files for Claude Code/wrangler.toml`** — Worker configuration. Worker variables (`GITHUB_OWNER`, `GITHUB_REPO`) live here; secrets are set separately via `wrangler secret put`.
