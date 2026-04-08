# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal closet management web application — a visual wardrobe inventory and styling tool. It catalogs clothing items with rich metadata, supports browsing/filtering, and provides detailed item inspection. Hosted on Cloudflare Pages.

**No build system.** This is a static site (HTML + CSS + JS + JSON). Open files directly in a browser or serve with any static file server (e.g., `python3 -m http.server`).

## Key Files

All working files live in `Files for Claude Code/`:

| File | Role |
|------|------|
| `index.html` | Public read-only gallery viewer |
| `closet-manager.html` | 3-panel admin/editing interface |
| `closet.json` | All item and outfit data (single source of truth) |
| `closet-spec-v1.md` | Canonical data schema and taxonomy — **read this before editing the data model** |

## Architecture

### Data Model (`closet.json`)
- **Schema-first, UUID-keyed.** Every item has a stable UUID. Outfits reference items by UUID.
- Two top-level record types: `items` (clothing/accessories) and `outfits`.
- The schema is documented exhaustively in `closet-spec-v1.md`, including all controlled vocabularies. Do not add new field names or enum values without checking that spec first.

### Gallery (`index.html`)
- Read-only viewer; renders items from `closet.json` via `fetch()`.
- State: `allItems`, `activeFilter`, `searchQuery` — all managed in plain JS globals.
- Filter buttons are generated dynamically from the departments present in the data.
- Search spans name, brand, category, colors, and tags.
- Detail view opens as a slide-in drawer (no routing).

### Manager (`closet-manager.html`)
- 3-panel layout: item list → form editor → live preview.
- Saves data back via GitHub API integration (token-based, stored in `localStorage`).
- Fabric composition editor uses dynamic material+percentage pairs.
- Multi-select fields (seasons, sustainability, embellishments) use custom toggle buttons, not `<select multiple>`.

### Design System
CSS custom properties are defined at `:root` in each HTML file. Key tokens:
- **Ink** `#1c1917`, **Paper** `#faf9f7`, **Sage** `#2d4a2d` / `#4a7c4a`
- **Typography**: `Cormorant Garamond` (headings), `DM Mono` (UI/labels) — both loaded from Google Fonts.
- Spacing scale: 4px/8px border-radius, 1rem/1.5rem/2.5rem padding.

## Taxonomy & Controlled Vocabularies

`closet-spec-v1.md` defines valid values for all enums. Important ones:
- **Departments**: Clothing, Shoes, Bags, Accessories, Jewelry, Activewear, Swimwear, Lingerie & Loungewear
- **Formality**: integer 1–10 scale
- **Silhouette**, **pattern**, **fabric weight**, **seasons**, **sustainability** — all have fixed valid values listed in the spec

Adding a new department or category requires updating both `closet-spec-v1.md` (the spec) and any hardcoded filter/render logic in the HTML files.

## Image Strategy

Phase 1 (current): images are hosted on GitHub and referenced by URL in `closet.json`. Phase 2 (future): CDN migration. Do not embed images as base64 or local paths.

## Build Phase Sequence (from spec)

The spec defines 6 build phases not yet complete: inline editing, add-item flow, wearing log, outfit builder, analytics dashboard, and mobile PWA. Check the spec's "Build Phase Sequence" section before starting work on any new feature to understand intended scope and ordering.
