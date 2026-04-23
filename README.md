# Profile Intelligence Service — Stage 2

A RESTful API that stores enriched demographic profiles and supports advanced filtering, sorting, pagination, and natural language querying.

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **External APIs**: Genderize, Agify, Nationalize

---

## Project Structure

```
profile-service/
├── src/
│   ├── index.js                  # App entry point
│   ├── db.js                     # PostgreSQL pool + schema init + indexes
│   ├── seed.js                   # Seed script (reads data/profiles.json)
│   ├── routes/
│   │   └── profiles.js           # All endpoints
│   └── services/
│       ├── enrichment.js         # Genderize + Agify + Nationalize
│       ├── countries.js          # ISO code ↔ country name mapping
│       └── nlpParser.js          # Rule-based NLP parser
├── data/
│   └── profiles.json             # ← Place seed file here (gitignored)
├── .env.example
├── Dockerfile
├── package.json
└── README.md
```

---

## Local Setup

```bash
git clone <your-repo-url>
cd profile-service
npm install
cp .env.example .env
# Edit .env → set DATABASE_URL
npm run dev
```

### Seed the database

Place the provided `profiles.json` at `data/profiles.json`, then:

```bash
npm run seed
# ✅ Done. Inserted: 2026 | Skipped (duplicates): 0
```

Safe to re-run — duplicates are skipped automatically using `ON CONFLICT (name) DO NOTHING`.

---

## API Endpoints

### `POST /api/profiles` — Create profile

```bash
curl -X POST /api/profiles -d '{"name": "fatima"}'
```

### `GET /api/profiles` — List with filtering, sorting, pagination

**All supported filters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `gender` | string | `male` or `female` |
| `age_group` | string | `child`, `teenager`, `adult`, `senior` |
| `country_id` | string | ISO-2 code e.g. `NG`, `KE`, `US` |
| `min_age` | number | Minimum age inclusive |
| `max_age` | number | Maximum age inclusive |
| `min_gender_probability` | float | e.g. `0.9` |
| `min_country_probability` | float | e.g. `0.5` |
| `sort_by` | string | `age`, `created_at`, `gender_probability` |
| `order` | string | `asc` or `desc` (default: `desc`) |
| `page` | number | Default: `1` |
| `limit` | number | Default: `10`, max: `50` |

```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

### `GET /api/profiles/search?q=<query>` — Natural language search

```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=adult females above 30&page=2&limit=5
```

### `GET /api/profiles/:id` — Get one profile
### `DELETE /api/profiles/:id` — Delete profile (returns `204`)

---

## Natural Language Query Parser

### Overview

The `/api/profiles/search` endpoint accepts plain English via the `q` param and converts it into structured PostgreSQL filters. The parser is entirely rule-based — no AI, no external services, no LLMs.

**How it works (step by step):**

1. Lowercase and trim the raw query string
2. Detect gender using regex word boundaries (`\b`)
3. If both male AND female keywords appear → remove gender filter (no restriction)
4. Detect age group or "young" keyword → map to `age_group` or `min_age/max_age`
5. Detect numeric age qualifiers (above/below/between) via regex
6. Detect country using "from X" or "in X" pattern → resolve to ISO code
7. If zero filters extracted → return `Unable to interpret query`
8. Execute parameterized SQL with extracted filters + pagination

---

### Supported Keywords

#### Gender

| Input words | Resolved filter |
|-------------|----------------|
| `male`, `males`, `man`, `men` | `gender = male` |
| `female`, `females`, `woman`, `women`, `girl`, `girls` | `gender = female` |
| Both male AND female in same query | No gender filter (returns all) |

#### Age Groups

| Input words | Resolved filter |
|-------------|----------------|
| `young` | `min_age = 16`, `max_age = 24` *(parsing only — not a stored age group)* |
| `teenager`, `teenagers`, `teen`, `teens` | `age_group = teenager` |
| `adult`, `adults` | `age_group = adult` |
| `senior`, `seniors`, `elderly` | `age_group = senior` |
| `child`, `children`, `kids`, `kid` | `age_group = child` |

#### Numeric Age Qualifiers

| Pattern | Resolved filter |
|---------|----------------|
| `above N`, `over N`, `older than N` | `min_age = N` |
| `below N`, `under N`, `younger than N` | `max_age = N` |
| `between N and M` | `min_age = N`, `max_age = M` |
| `aged N`, `age N` | `min_age = N` AND `max_age = N` |

#### Country Resolution

Patterns `from [country]` and `in [country]` are matched. The captured country name is resolved against a built-in map of 150+ countries. Multi-word names (e.g. "south africa") are handled by progressive substring matching from longest to shortest.

Common aliases supported: `usa → US`, `england → GB`, `uae → AE`, `drc → CD`, `ivory coast → CI`, etc.

---

### Example Query Mappings

| Query | Resolved Filters |
|-------|-----------------|
| `young males` | `gender=male, min_age=16, max_age=24` |
| `young males from nigeria` | `gender=male, min_age=16, max_age=24, country_id=NG` |
| `females above 30` | `gender=female, min_age=30` |
| `people from angola` | `country_id=AO` |
| `adult males from kenya` | `gender=male, age_group=adult, country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager, min_age=17` |
| `Male and female teenagers above 17` | `age_group=teenager, min_age=17` *(case insensitive)* |
| `seniors in ghana` | `age_group=senior, country_id=GH` |
| `women under 25` | `gender=female, max_age=25` |
| `men between 30 and 45` | `gender=male, min_age=30, max_age=45` |

---

### Implementation Details

**Word boundary matching:** All gender and age group keywords are matched using `\b` regex anchors (e.g. `/\b(male|males|man|men)\b/`). This prevents partial matches inside longer words like "female" matching "males" or "senior" matching "seniors".

**Country extraction:** Uses a greedy capture after `from`/`in`, then strips trailing stop words (`above`, `below`, `between`, `and`, etc.). Multi-word country names are resolved by trying progressively shorter substrings.

**"Young" is not a stored age group.** It maps to `min_age=16, max_age=24` for query filtering only. The database stores actual groups: child, teenager, adult, senior.

**Both genders cancel out.** Queries like "male and female teenagers" will not filter by gender — both genders are implied. Only age/country filters are applied.

---

### Limitations and Known Edge Cases

- **No compound country logic:** "from nigeria or ghana" only resolves the first country match. OR logic across countries is not supported.
- **No negation:** "not male", "excluding seniors", "non-adults" are not parsed. Negation returns "Unable to interpret query".
- **No probability filters from natural language:** "highly confident females" cannot be parsed. Use `min_gender_probability` on the structured endpoint instead.
- **"young" vs stored age groups:** "young adult" will match "young" first (min_age=16, max_age=24) and ignore "adult". Priority goes to the first match.
- **No spelling correction:** Typos like "femail" or "nigerria" won't match. Exact spelling is required for all keywords.
- **Ambiguous country without preposition:** "nigeria males" without "from" or "in" will NOT resolve the country. The preposition is required.
- **No relative time:** "recently added" or "created last month" are not supported.
- **No sorting from natural language:** "sorted by age" is not parsed. Use the `sort_by` parameter on the structured endpoint.
- **Single age group wins:** If both "young" and "adult" appear in the same query, whichever is matched first by the regex wins.

---

## Deployment (Railway)

1. Push to GitHub (public repo)
2. Railway → New Project → Deploy from GitHub
3. Add PostgreSQL service → auto-injects `DATABASE_URL`
4. Set `NODE_ENV=production` in Variables tab
5. Generate domain → Settings → Networking → Public Networking
6. Seed production DB: set Railway external DB URL in local `.env` → run `npm run seed`

---

## Age Group Reference

| Range | Stored Group |
|-------|-------------|
| 0–12 | child |
| 13–19 | teenager |
| 20–59 | adult |
| 60+ | senior |
| 16–24 *(query-time only)* | young |
