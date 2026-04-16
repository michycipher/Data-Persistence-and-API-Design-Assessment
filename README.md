# Profile Service -- stage one task

A RESTful API that enriches a name with gender, age, and nationality data from third-party APIs and persists the result.

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
│   ├── index.js               # App entry point
│   ├── db.js                  # PostgreSQL pool + schema init
│   ├── routes/
│   │   └── profiles.js        # All 4 endpoints
│   └── services/
│       └── enrichment.js      # External API calls + validation
├── .env
├── Dockerfile
├── package.json
└── README.md
```

---

## Local Setup

### Prerequisites

- Node.js >= 18
- PostgreSQL (running locally or via Docker)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd profile-service
npm install
```

### 2. Create PostgreSQL Database

```bash
psql -U postgres
CREATE DATABASE profile_service;
\q
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/profile_service
PORT=3000
NODE_ENV=development
```

### 4. Run

```bash
npm run dev      # development (nodemon, auto-reload)
# or
npm start        # production
```

Server starts on `http://localhost:3000`

---

## API Endpoints

### `POST /api/profiles`

Create a profile. Idempotent – returns existing record if name already exists.

**Request**
```json
{ "name": "ella" }
```

**Response 201**
```json
{
  "status": "success",
  "data": {
    "id": "019503a1-...",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.98,
    "sample_size": 12345,
    "age": 34,
    "age_group": "adult",
    "country_id": "US",
    "country_probability": 0.24,
    "created_at": "2026-04-01T12:00:00.000Z"
  }
}
```

**Response 200** (already exists)
```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": { "...existing profile..." }
}
```

---

### `GET /api/profiles`

List all profiles. Supports optional case-insensitive filters.

**Query params**: `gender`, `country_id`, `age_group`

```
GET /api/profiles?gender=female&country_id=US
```

**Response 200**
```json
{
  "status": "success",
  "count": 1,
  "data": [
    { "id": "...", "name": "ella", "gender": "female", "age": 34, "age_group": "adult", "country_id": "US" }
  ]
}
```

---

### `GET /api/profiles/:id`

Get a single profile by UUID.

**Response 200**
```json
{ "status": "success", "data": { "...full profile..." } }
```

**Response 404**
```json
{ "status": "error", "message": "Profile not found" }
```

---

### `DELETE /api/profiles/:id`

Delete a profile. Returns `204 No Content`.

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400  | Missing or empty `name` |
| 422  | `name` is not a string |
| 404  | Profile not found |
| 502  | External API (Genderize / Agify / Nationalize) returned invalid data |
| 500  | Internal server error |

---

## Deployment on Railway (Recommended)

Railway gives you a free PostgreSQL database and a public URL.

### Step 1 – Push to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/profile-service.git
git push -u origin main
```

### Step 2 – Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Choose **Deploy from GitHub repo** → select your repo
3. Railway auto-detects Node.js and builds it

### Step 3 – Add PostgreSQL

1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway automatically sets `DATABASE_URL` in your app's environment

### Step 4 – Set environment variable

In your app service settings → **Variables**:

```
NODE_ENV=production
```

(`DATABASE_URL` is injected automatically from the Postgres service)

### Step 5 – Get your public URL

In the app service → **Settings** → **Domains** → click **Generate Domain**.

Your API is live at:
```
https://your-app-name.up.railway.app
```

Test it:
```bash
curl -X POST https://your-app-name.up.railway.app/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"name": "emma"}'
```

---

## Deployment on Vercel (Serverless)

> **Note**: Vercel uses serverless functions. You need an **external** Postgres host (e.g. [Neon](https://neon.tech) – free tier available).

### Step 1 – Create a Neon database

1. Go to [neon.tech](https://neon.tech) → Create project → copy the connection string.

### Step 2 – Add `vercel.json`

```json
{
  "version": 2,
  "builds": [{ "src": "src/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.js" }]
}
```

### Step 3 – Deploy

```bash
npm i -g vercel
vercel --prod
```

Set `DATABASE_URL` and `NODE_ENV=production` in the Vercel dashboard.

---

## Age Group Reference

| Age Range | Group |
|-----------|-------|
| 0 – 12    | child |
| 13 – 19   | teenager |
| 20 – 59   | adult |
| 60+       | senior |
