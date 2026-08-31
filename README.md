# Peblo TV Mini

Peblo TV Mini is a small full-stack streaming catalogue platform built for the
Peblo take-home challenge. It models an editorial workflow in which content
editors manage shows and episodes, an administrator publishes an approved
catalogue, and a viewer-facing application reads only the published catalogue.

The project is intentionally implemented as a modular monolith. The API,
database, CMS, viewer, publishing workflow, and local storage adapter are
separate modules and runtime containers, but remain simple to run and operate.

## What Has Been Built

### Backend API

- FastAPI application with PostgreSQL support and SQLite support for local tests.
- Normalized data model:
  - Shows
  - Seasons
  - Episodes
  - Artwork
  - Publish runs
- CRUD endpoints for shows, seasons, and episodes.
- Server-side show pagination and filtering by search, section, status, and
  language.
- Episode listing by season.
- Validation for allowed sections, categories, languages, statuses, titles,
  episode numbers, and durations.
- Duplicate `(content_group, language)` validation for language variants.
- Artwork upload endpoint with server-side validation for:
  - Poster: exactly 600 x 900 pixels, 2:3 ratio
  - Banner: exactly 1280 x 720 pixels, 16:9 ratio
  - Thumbnail: exactly 640 x 360 pixels, 16:9 ratio
  - Maximum file size: 200 KB
  - Valid decoded image content
- Local filesystem storage behind a storage class boundary.
- Published catalogue generation containing only published shows and episodes.
- Deterministic section, show, season, and episode ordering.
- `content_group` language variants collapsed into one catalogue episode with a
  `languages` list.
- Season 0 excluded from normal viewer seasons because it is reserved for
  trailers.
- Atomic catalogue replacement using a temporary file, flush, `fsync`, and
  `os.replace`.
- Publish runs recording actor, timestamps, result, counts, and errors.
- Non-admin publish attempts rejected by the API.
- Editor-facing validation report with entity context and suggested fixes.
- Catalogue search by text, category, language, and section.
- Liveness and readiness endpoints.
- PostgreSQL driver URL normalization so both `postgresql://` and
  `postgresql+psycopg://` connection strings work.

### Internal CMS

- Token-based login for editor and administrator roles.
- Show library with:
  - Search
  - Section filter
  - Status filter
  - Language filter
  - Server-side pagination
- Create and edit show details.
- Create, edit, and delete seasons.
- Create, edit, and delete episodes.
- Episode fields for number, title, duration, language, content group, and
  status.
- Destructive actions require confirmation.
- Three labelled artwork slots with required dimensions and file-size guidance.
- Client-side artwork checks for fast feedback, backed by authoritative server
  validation.
- Publish area for administrators with validation blockers and publish history.
- Loading, empty, error, permission, and upload feedback states.
- Responsive layout for desktop and mobile.
- Runtime API URL configuration so the same frontend image can be deployed to
  different environments without rebuilding application code.

### Viewer Application

- Separate React application that calls only public catalogue endpoints.
- Featured hero using banner artwork.
- Horizontal catalogue rows grouped by section.
- Poster artwork for show cards.
- Thumbnail artwork for episode cards.
- Search with debounce and request cancellation.
- Category and language filters.
- Clear-filters action.
- Show detail view with synopsis, seasons, episodes, and available languages.
- Season 0 excluded from normal season display.
- Loading placeholders while artwork loads.
- Graceful image fallback when artwork is missing or unavailable.
- Empty, error, retry, and no-results states.
- Hash-based show navigation that supports direct links and browser refresh.
- Responsive layout and keyboard focus styling.
- Reduced-motion support.

## Architecture

```text
                         +----------------+
                         |  Internal CMS  |
                         | React / Vite   |
                         +-------+--------+
                                 |
                         authenticated API
                                 |
+------------+          +-------v--------+          +----------------+
| PostgreSQL | <------> | FastAPI API    | <------> | Local storage |
+------------+          | CRUD/publish   |          | artwork/file  |
                         +-------+--------+          +----------------+
                                 |
                         published catalogue
                                 |
                         +-------v--------+
                         | Viewer         |
                         | React / Vite   |
                         +----------------+
```

The viewer does not call administrative endpoints. It reads `/catalog` and
`/catalog/search`, which are generated from the last successful publish.

## Repository Structure

```text
backend/
  app/
    main.py              FastAPI routes and application setup
    models.py            SQLAlchemy models
    schemas.py           Request validation and response helpers
    validation.py        Publish-blocking validation report
    catalog.py           Catalogue construction and grouping
    storage.py           Local storage adapter and atomic writes
    auth.py              Role enforcement
    seed.py              Idempotent challenge-data import
  alembic/               Versioned database migrations
  start.sh               Container migration, seed, and API startup
  tests/                 Backend tests
cms/                     Internal editorial React application
viewer/                  Public viewer React application
seed_shows.json          Supplied raw content data
reference.json           Allowed content and artwork conventions
render.yaml              Render Blueprint deployment configuration
.github/workflows/ci.yml Continuous integration workflow
```

## Run Locally

Requirements:

- Docker Desktop with Docker Compose
- Or Python 3.10+ and Node.js 22+ for individual development

Start the complete stack:

```sh
docker compose up --build
```

Open:

- Viewer: http://localhost:4174
- CMS: http://localhost:4173
- API documentation: http://localhost:8000/docs
- API health: http://localhost:8000/health/ready

The API container performs these startup steps:

1. Runs `alembic upgrade head`.
2. Imports the 95 supplied episode rows idempotently.
3. Generates a bootstrap catalogue when one does not exist.
4. Starts Uvicorn.

To stop the local stack:

```sh
docker compose down
```

The database and API storage are stored in named Docker volumes. To remove
local data and start from a completely clean state:

```sh
docker compose down -v
```

## Authentication

The API uses bearer tokens for this challenge version:

```http
Authorization: Bearer <token>
```

Roles:

- Editor: create, view, edit, delete, and upload content.
- Admin: all editor permissions plus validation reports, run history, and
  catalogue publishing.

The API enforces these permissions server-side. The UI only hides controls as a
convenience and is not the security boundary.

### Deployment Credentials

The administrator and editor credentials are deployment secrets and are not
stored in this repository or README. Configure them in the Render dashboard on
the `peblo-api` service:

```text
EDITOR_TOKEN=<editor deployment secret>
ADMIN_TOKEN=<admin deployment secret>
```

Use the supplied credentials from the project owner when signing in to the
deployed CMS. If credentials are ever exposed, rotate them immediately in
Render and redeploy the API. The local Compose defaults are development-only
and must not be used in production.

## Publishing Flow

1. An editor creates or updates a show, season, episode, and artwork.
2. The editor or administrator reviews `/admin/validation-report`.
3. The report identifies missing sections, missing duration, missing artwork,
   and duplicate language variants.
4. An administrator opens the publish screen.
5. Publishing is rejected if blocking issues remain.
6. The API builds a complete catalogue in memory.
7. The catalogue is written to a temporary file and flushed to disk.
8. `os.replace` atomically swaps the temporary file into the configured live
   catalogue path.
9. The publish run is recorded with outcome and counts.

If the process dies before the atomic replacement, the previous catalogue is
still available. If it dies after replacement, readers see either the complete
old file or the complete new file, never a partially written JSON document.

## Data Conventions

- Season 0 is reserved for trailers and is excluded from normal viewer season
  lists.
- Episodes with the same `content_group` are language variants of one episode.
- Variants are collapsed into one catalogue episode with an available-language
  list.
- Published shows require a section.
- Published episodes require duration and artwork.
- The supplied seed data intentionally contains imperfect rows so the
  validation workflow can be demonstrated.

## API Endpoints

Public endpoints:

- `GET /`
- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /catalog`
- `GET /catalog/search?q=&category=&language=&section=`

Authenticated editor endpoints:

- `GET /auth/me`
- `GET /admin/shows`
- `POST /admin/shows`
- `GET /admin/shows/{id}`
- `PATCH /admin/shows/{id}`
- `DELETE /admin/shows/{id}`
- `POST /admin/shows/{id}/seasons`
- `GET /admin/shows/{id}/seasons`
- `GET /admin/seasons/{id}`
- `PATCH /admin/seasons/{id}`
- `DELETE /admin/seasons/{id}`
- `GET /admin/seasons/{id}/episodes`
- `POST /admin/seasons/{id}/episodes`
- `GET /admin/episodes/{id}`
- `PATCH /admin/episodes/{id}`
- `DELETE /admin/episodes/{id}`
- `POST /admin/episodes/{id}/artwork/{kind}`
- `GET /admin/validation-report`
- `GET /admin/catalog/runs`

Administrator-only endpoint:

- `POST /admin/catalog/publish`

## Configuration

Copy `.env.example` and provide environment-specific values. Important
variables include:

```text
DATABASE_URL=postgresql+psycopg://user:password@host/peblo
STORAGE_DIR=/app/storage
CATALOG_PATH=/app/storage/catalogue.json
EDITOR_TOKEN=<secret>
ADMIN_TOKEN=<secret>
ALLOWED_ORIGINS=http://localhost:4173,http://localhost:4174
ENVIRONMENT=development
```

In production, secrets should be injected from the hosting provider's secret
manager. They should not be committed to Git, placed in Dockerfiles, or printed
in CI logs.

## Testing and Verification

Backend tests:

```sh
cd backend
python -m pytest -q
```

Frontend builds:

```sh
cd cms
npm ci
npm run build

cd ../viewer
npm ci
npm run build
```

Additional checks:

```sh
python -m pip check
docker compose config
```

The current backend suite covers role enforcement, blocked publishing, artwork
dimension rejection, season listing, pagination, readiness, and language
variants. CI also runs Python compilation, frontend builds, npm vulnerability
audits, and Docker image builds.

## Deployment With Render

`render.yaml` defines three Docker web services:

- `peblo-api`
- `peblo-cms`
- `peblo-viewer`

The no-card demo setup uses Render free web services and an external free
PostgreSQL provider such as Neon or Supabase.

### Required Setup

1. Create a free PostgreSQL database in Neon or Supabase.
2. Copy its connection string.
3. Create a Render Blueprint from this GitHub repository.
4. Select the `main` branch.
5. Supply the PostgreSQL connection string as `DATABASE_URL` on `peblo-api`.
6. Add strong `EDITOR_TOKEN` and `ADMIN_TOKEN` values on `peblo-api`.
7. Confirm `API_BASE_URL` on both frontend services is the real deployed API
   URL.
8. Confirm `ALLOWED_ORIGINS` on the API contains the real CMS and viewer URLs.
9. Deploy all three services.

The API starts with `/app/start.sh`, which runs migrations, seeds the catalogue,
and starts Uvicorn. Render uses `/health/ready` as its health check.

### Deployment Checks

After deployment, verify:

```text
https://<api-host>/
https://<api-host>/health/ready
https://<api-host>/docs
https://<api-host>/catalog
https://<cms-host>/config.js
https://<viewer-host>/config.js
```

The frontend `config.js` files must point to the actual API hostname. If the
services were created before a configuration commit, use **Clear build cache &
deploy** for the affected frontend service.

### Free-Tier Limitation

Render free services may sleep and have ephemeral filesystems. The demo seed is
rerun on startup, but uploaded artwork and locally generated catalogue files
are not durable across restarts. Production deployment should use a paid
persistent disk or an R2/S3-compatible storage adapter, a managed database with
backups, and a deployment platform with stable service uptime.

## Storage Decision

The current `LocalStorage` adapter provides:

- Atomic artwork writes.
- Atomic catalogue replacement.
- A stable relative path contract for API responses.

Moving to Cloudflare R2 or S3 should replace the adapter rather than the domain
logic. The production adapter would write artwork and versioned catalogue
objects, validate the complete catalogue, and update a current-version pointer
only after the object is complete. A retention policy would preserve previous
catalogue versions for recovery.

## Search Decision

Search currently reads the pre-published catalogue JSON. This keeps viewer reads
fast, cacheable, independent of CMS database load, and easy to operate for the
small challenge catalogue. It also means edits are invisible to viewers until a
successful publish.

The approach stops being appropriate when the catalogue becomes large enough
that parsing the entire JSON file for every search request creates measurable
latency or memory pressure. The next step would be PostgreSQL full-text search
for moderate scale, or a dedicated search index for ranked, paginated search at
larger scale.

## Why A Published Catalogue

The viewer is deliberately decoupled from editorial database operations. A
pre-published file gives the viewer a stable, cacheable snapshot and prevents
partially edited CMS data from appearing publicly. The trade-off is release
latency: changes require a successful publish, and catalogue storage needs an
atomic or versioned promotion strategy.

## CI and Operations

GitHub Actions runs on pushes and pull requests. It currently performs:

- Python dependency installation.
- Python compilation.
- Backend tests.
- Python package consistency checks.
- CMS and viewer dependency installation.
- CMS and viewer production builds.
- High-severity npm audit checks.
- Docker image builds.

Recommended production alerts are repeated readiness failures, catalogue-read
failures, and failed publish runs. These indicate either viewer availability
problems or editorial changes that cannot reach the public catalogue.

## Scope and Trade-offs

Intentionally not included:

- Video playback and streaming.
- Full identity-provider integration; the challenge uses static bearer tokens.
- Catalogue rollback UI and dry-run publish diffs.
- Full audit history of every content mutation.
- Production R2/S3 implementation; the storage boundary is prepared for it.
- Automated cloud deployment; Render configuration and deployment instructions
  are provided, but credentials and provider account actions remain external.
- TanStack Query; the applications use small native fetch wrappers because the
  challenge has a limited number of views and API calls. A server-state library
  would be appropriate as the CMS grows.

## AI Assistance

AI assistance was used for scaffolding, code review prompts, and identifying
edge cases. Generated output was checked against the requirements, compiled,
tested, exercised through Docker, and manually reviewed. Decisions around
publishing atomicity, storage boundaries, role enforcement, validation, and
deployment behavior were retained only after verification against the project
requirements.

## Submission Verification

The final local verification completed successfully with:

- Backend tests passing.
- CMS production build passing.
- Viewer production build passing.
- Docker images building successfully.
- PostgreSQL, API, CMS, and viewer containers reporting healthy.
- API readiness, catalogue, search, authenticated editor access, frontend
  entrypoints, and editor publish denial verified through HTTP smoke tests.
