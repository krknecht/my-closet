# Closet — Data Architecture Specification v1.3
*Locked for build phase. Last updated: April 2026. Silhouette vocabulary added, taxonomy edits applied, length vocabulary expanded (Thigh, Ankle added), sleeve_length field added.*

---

## 1. Design Principles

- **Schema-first.** The JSON schema is the source of truth. The UI, the gallery, and Claude's reasoning all derive from it.
- **UUID-keyed.** Every item and every image is identified by a UUID v4. Nothing is keyed by name, slug, or filename.
- **Arrays over strings.** Any field that might have multiple values (seasons, occasions, sustainability markers, fabric components) is stored as an array, not a delimited string.
- **Structured over free text.** Where options are enumerable (pattern, weight, size system), they are stored as controlled vocabulary values. Free text is reserved for fields that are genuinely open-ended.
- **Separation of concerns.** Item metadata, wearing history, and outfit logs are separate record types. They reference each other by ID.
- **Forward-compatible.** Fields that are empty today (`outfit_log`, `works_with`, `times_worn`) are included in the schema now so future features don't require migration.

---

## 2. JSON Schema

### 2.1 Top-level structure (`closet.json`)

```json
{
  "version": "1.0",
  "schema_updated": "2026-04-07",
  "owner_id": "string (uuid — for multi-user future)",
  "items": [ /* Item records — see 2.2 */ ],
  "outfits": [ /* Outfit records — see 2.3 */ ]
}
```

---

### 2.2 Item record

```json
{
  "id": "uuid-v4",
  "created_at": "ISO 8601 datetime",
  "updated_at": "ISO 8601 datetime",
  "status": "active | archived | sold | donated",

  "identity": {
    "name": "string",
    "brand": "string",
    "collection_season": "string | null",
    "year_acquired": "number | null",
    "vintage": {
      "is_vintage": "boolean",
      "era": "string | null"
    },
    "sku": "string | null",
    "colorway_name": "string | null"
  },

  "category": {
    "department": "string",
    "category": "string",
    "subcategory": "string | null"
  },

  "image": {
    "filename": "uuid.ext",
    "format": "jpg | jpeg | png | webp | avif",
    "alt_images": [ "uuid.ext" ]
  },

  "visual": {
    "colors": {
      "primary": "string | null",
      "secondary": "string | null",
      "tertiary": "string | null"
    },
    "pattern": "Solid | Stripe | Plaid / Check | Floral | Geometric | Animal print | Abstract | Graphic | Embellished | Other | null",
    "print_description": "string | null",
    "silhouette": "string | null",
    "length": "Cropped | Hip | Thigh | Waist | Knee | Midi | Maxi | Ankle | Floor | null",
    "sleeve_length": "Strapless | Sleeveless | Cap sleeve | Short sleeve | Three-quarter | Long sleeve | null",
    "embellishment": [ "None | Beading | Embroidery | Sequins | Ruching | Ruffles | Fringe | Hardware | Other" ]
  },

  "construction": {
    "fabric": [
      { "material": "string", "percentage": "number | null" }
    ],
    "lining": {
      "type": "None | Partial | Full | null",
      "material": "string | null"
    },
    "weight": "Sheer | Lightweight | Medium | Medium-heavy | Heavy | null",
    "structure": "Unstructured | Soft | Semi-structured | Structured | Boned | null",
    "seasons": [ "spring | summer | fall | winter" ],
    "care": "string | null",
    "country_of_origin": "string | null",
    "sustainability": [ "Organic | Recycled | Deadstock | Vintage | Upcycled | None" ]
  },

  "fit": {
    "cut": "string | null",
    "size": "string | null",
    "size_system": "US | FR | IT | UK | EU | One size | Numerical | null",
    "inseam_length": "string | null",
    "fit_notes": "string | null",
    "fit_relative": "True to size | Runs small | Runs large | null"
  },

  "wearing_profile": {
    "formality": {
      "min": "number (1–10)",
      "max": "number (1–10)"
    },
    "occasions": [ "string" ],
    "feels": [ "string" ],
    "style_notes": "string | null",
    "works_with": [ "item uuid" ]
  },

  "provenance": {
    "retailer": "string | null",
    "source_url": "string | null",
    "purchase_price": {
      "amount": "number | null",
      "currency": "string | null"
    },
    "retail_price": {
      "amount": "number | null",
      "currency": "string | null"
    },
    "condition_at_acquisition": "New with tags | New without tags | Like new | Good | Fair | Poor | null",
    "current_condition": "New with tags | New without tags | Like new | Good | Fair | Poor | null",
    "storage_location": "string | null",
    "acquisition_type": "Purchased | Gifted | Vintage | Secondhand | Borrowed | Tailored | Archive | null"
  },

  "wearing_history": {
    "last_worn": "ISO 8601 date | null",
    "times_worn": "number",
    "cost_per_wear": "number | null (calculated: purchase_price / times_worn)",
    "outfit_log": [ "outfit uuid" ]
  },

  "meta": {
    "tags": [ "string" ],
    "notes": "string | null",
    "claude_context": "string | null"
  }
}
```

---

### 2.3 Outfit record

```json
{
  "id": "uuid-v4",
  "created_at": "ISO 8601 datetime",
  "date_worn": "ISO 8601 date | null",
  "occasion": "string | null",
  "items": [ "item uuid" ],
  "image": "uuid.ext | null",
  "notes": "string | null"
}
```

---

## 3. Category Taxonomy

Three levels: **Department → Category → Subcategory.**
Silhouette is a per-category controlled vocabulary field — valid values listed per category below.
Formality, occasion, and season are item *attributes*, not taxonomy nodes.

---

### CLOTHING

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Tops** | T-shirt, Tank / Cami, Blouse, Shirt / Button-down, Polo, Bodysuit, Halter top, Bralette, Corset | Fitted, Semi-fitted, Relaxed, Oversized, Boxy, Draped, Wrap, Corseted, Asymmetric |
| **Knitwear** | Crewneck sweater, V-neck sweater, Cardigan, Turtleneck, Vest / Tank knit, Sweater vest, Twin set | Fitted, Semi-fitted, Relaxed, Oversized, Boxy, Cocoon, Longline |
| **Sweatshirts & Hoodies** | Crewneck sweatshirt, Hoodie, Zip-up sweatshirt | Fitted, Relaxed, Oversized, Boxy, Cropped |
| **Jackets** | Blazer, Leather jacket, Denim jacket, Bomber, Track jacket, Overshirt, Utility jacket, Cape / Poncho, Vest / Gilet, Evening jacket | Fitted / Tailored, Semi-fitted, Relaxed, Oversized, Boxy, Longline, Cropped, Double-breasted, Cocoon |
| **Coats** | Trench coat, Overcoat / Topcoat, Wool coat, Puffer / Down coat, Shearling coat, Fur coat, Raincoat / Windbreaker, Parka, Cape coat | Fitted / Tailored, Semi-fitted, Relaxed, Oversized, A-line, Cocoon, Cape, Wrap, Double-breasted, Longline |
| **Suits & Sets** | Suit jacket, Suit trouser, Full suit, Co-ord / Matching set, Tuxedo jacket | Fitted / Tailored, Semi-fitted, Relaxed, Oversized, Double-breasted |
| **Dresses** | Mini dress, Midi dress, Maxi dress, Gown, Shirt dress, Wrap dress, Slip dress, Bodycon dress, Smock / Tiered dress, Strapless dress, Cocktail dress | Fitted / Bodycon, Semi-fitted, A-line, Wrap, Shift / Column, Empire waist, Ballgown / Full skirt, Mermaid / Trumpet, Slip, Tiered / Smock, Asymmetric |
| **Jumpsuits & Playsuits** | Jumpsuit, Playsuit / Romper, Boilersuit | Fitted, Semi-fitted, Relaxed, Wide-leg, Tailored, Wrap |
| **Trousers** | Tailored trouser, Wide-leg trouser, Straight trouser, Cropped trouser, Pleated trouser, Cargo pant, Jogger / Sweatpant, Legging | Straight, Tapered, Wide-leg, Flared, Pleated front, Flat front |
| **Jeans** | Straight, Slim, Wide-leg, Bootcut, Skinny, Barrel / Baggy, Cropped, Flare | *(not applicable)* |
| **Skirts** | Mini skirt, Midi skirt, Maxi skirt, Pencil skirt, A-line skirt, Wrap skirt, Pleated skirt, Leather skirt | A-line, Straight / Pencil, Wrap, Full / Circle, Tiered, Asymmetric, Bias cut, Slit |
| **Shorts** | Tailored short, Denim short, Casual / Relaxed short, Cycling short | Fitted, Relaxed, Wide-leg, Tailored, Boxy |

---

### SHOES

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Heels** | Pump, Block heel, Kitten heel, Wedge, Platform heel, Mule heel, Sandal heel, Slingback | *(not applicable)* |
| **Flats** | Ballet flat, Pointed flat, Loafer, Mary Jane, Mule flat, Sandal flat, Slides, Flip flops, Slingback | *(not applicable)* |
| **Boots** | Ankle boot, Chelsea boot, Knee-high boot, Over-the-knee boot, Combat boot, Western / Cowboy boot, Platform boot | *(not applicable)* |
| **Sneakers** | Low-top, High-top, Trainer / Running, Platform sneaker | *(not applicable)* |

---

### BAGS

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Bags** | Shoulder bag, Crossbody, Tote, Top-handle, Clutch, Mini bag / Micro bag, Belt bag / Fanny pack, Bucket bag, Backpack, Hobo, Wristlet, Pouch | *(not applicable)* |

---

### ACCESSORIES

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Belts** | Leather belt, Wrap belt, Chain belt, Elastic / Fabric belt, Corset belt | *(not applicable)* |
| **Scarves & Wraps** | Silk scarf, Wool scarf, Wrap / Shawl, Bandana | *(not applicable)* |
| **Hats** | Baseball cap, Bucket hat, Beret, Fedora, Wide-brim hat, Beanie, Visor, Cowboy hat | *(not applicable)* |
| **Sunglasses** | Aviator, Cat-eye, Round, Square / Rectangle, Oversized, Shield | *(not applicable)* |
| **Gloves** | — | *(not applicable)* |
| **Hair Accessories** | — | *(not applicable)* |
| **Socks & Tights** | — | *(not applicable)* |

---

### JEWELRY

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Fine Jewelry** | Ring, Necklace, Earrings, Bracelet, Brooch, Watch | *(not applicable)* |
| **Fashion Jewelry** | Ring, Necklace, Earrings, Bracelet, Brooch | *(not applicable)* |

---

### ACTIVEWEAR

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Activewear** | Sports bra, Legging, Shorts, Top, Jacket, Bodysuit | *(inherits from corresponding clothing category)* |

---

### SWIMWEAR

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Swimwear — Bikini top** | Bikini top | Bandeau, Triangle, Halter, Underwire / Structured, Bralette, Wrap |
| **Swimwear — Bikini bottom** | Bikini bottom | *(not applicable — future cut/coverage field)* |
| **Swimwear — One-piece** | One-piece | Fitted, Semi-fitted, Wrap, Plunge, Cutout, High-leg |
| **Swimwear — Cover-up** | Cover-up | Relaxed, Wrap, Kaftan, Oversized |

---

### LINGERIE & LOUNGEWEAR

| Category | Subcategories | Silhouette options |
|---|---|---|
| **Lingerie — Foundational** | Bralette, Brief, Bodysuit, Slip | Fitted, Semi-fitted, Relaxed, Wrap, Corseted |
| **Loungewear** | Robe, Pajama set | Relaxed, Wrap, Oversized |

---

## 4. Controlled Vocabulary Reference

These are the valid values for enumerated fields. The UI enforces these; the schema validates against them.

**Pattern**
Solid, Stripe, Plaid / Check, Floral, Geometric, Animal print, Abstract, Graphic, Embellished, Other

**Length**
Cropped, Hip, Thigh, Waist, Knee, Midi, Maxi, Ankle, Floor

**Embellishment** (multi-select)
None, Beading, Embroidery, Sequins, Ruching, Ruffles, Fringe, Hardware, Other

**Silhouette** (values are per-category — see Section 3. Not applicable to Shoes, Bags, Accessories, Jewelry.)

**Sleeve length** (applies to Tops, Knitwear, Sweatshirts & Hoodies, Dresses, Jumpsuits & Playsuits, Activewear, Swimwear, Lingerie. Null for all other departments.)
Strapless, Sleeveless, Cap sleeve, Short sleeve, Three-quarter, Long sleeve

**Weight**
Sheer, Lightweight, Medium, Medium-heavy, Heavy

**Structure**
Unstructured, Soft, Semi-structured, Structured, Boned

**Seasons** (multi-select)
spring, summer, fall, winter

**Sustainability** (multi-select)
Organic, Recycled, Deadstock, Vintage, Upcycled, None

**Fit relative**
True to size, Runs small, Runs large

**Lining type**
None, Partial, Full

**Size system**
US, FR, IT, UK, EU, One size, Numerical

**Condition**
New with tags, New without tags, Like new, Good, Fair, Poor

**Acquisition type**
Purchased, Gifted, Vintage, Secondhand, Borrowed, Tailored, Archive

**Status**
active, archived, sold, donated

**Formality scale**
1 = Loungewear, 2 = Casual, 3 = Weekend casual, 4 = Smart casual,
5 = Smart casual (elevated), 6 = Business casual, 7 = Business formal,
8 = Cocktail / Evening, 9 = Formal / Gala, 10 = Black tie

---

## 5. Image Strategy

### Naming convention
Every image is named by the item's UUID, preserving the original file extension:
```
{item-uuid}.jpg
{item-uuid}.webp
{item-uuid}.avif
{item-uuid}.png
```

Alt/additional images append an index:
```
{item-uuid}-2.webp
{item-uuid}-3.webp
```

### Phase 1 storage (prototype)
Images live in the GitHub repository root alongside `index.html` and `closet.json`.
Served via Cloudflare Pages at `my-closet.pages.dev/{uuid}.webp`.

### Phase 2 storage (product)
Images move to a CDN with user-scoped paths:
```
cdn.example.com/{user-uuid}/{item-uuid}.webp
```
The item record's `image.filename` field already stores only the UUID + extension — no path prefix — so the CDN base URL can be changed in one config variable with zero data migration.

### Accepted formats
AVIF (preferred), WebP, JPEG, PNG. No GIF. No BMP. No HEIC.

---

## 6. File Structure (Phase 1)

```
my-closet/ (GitHub repository)
├── index.html          ← Gallery UI (lightweight shell, fetches closet.json)
├── closet.json         ← All item and outfit data
├── {uuid}.avif         ← Item images, named by UUID
├── {uuid}.webp
├── {uuid}.jpg
└── {uuid}-2.webp       ← Alt images
```

The generator is a **separate local tool** (`item-card-generator-v3.html`) that runs locally and pushes to this repository via the GitHub API. It is never hosted or shipped as part of the product.

---

## 7. What changes from the current system

| Current | New |
|---|---|
| `closet-gallery.html` contains all data inline | `closet.json` is the data; `index.html` fetches it |
| Images named by item name slug | Images named by UUID |
| Item stored in browser sessionStorage | Item stored in `closet.json` on GitHub |
| One HTML file pushed per export | `closet.json` updated per item; `index.html` rarely changes |
| No outfit tracking | `outfits` array in `closet.json` |
| No wearing history | `wearing_history` block per item |
| Single flat file, no structure | Department → Category → Subcategory taxonomy |

---

## 8. Build phase sequence

1. **Build `closet.json` writer** — the generator produces and pushes structured JSON records, not HTML
2. **Build gallery shell** — `index.html` fetches `closet.json` and renders dynamically
3. **Build inline editor** — clicking a card opens an edit drawer; saves push a JSON update to GitHub
4. **Build add-item flow** — URL import + AI extraction + image upload, all in the gallery interface
5. **Build wearing log** — log an outfit, increment times_worn, update last_worn
6. **Build outfit builder** — combine items into saved outfits with their own records

Steps 1–2 are the foundation. Steps 3–4 replace the current generator workflow. Steps 5–6 are the intelligence layer.
