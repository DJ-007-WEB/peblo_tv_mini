# Peblo TV Mini

Peblo TV Mini is a modular monolith for managing children's shows, publishing a
stable catalogue, and browsing only published content. The first deployment is
intentionally monolithic: FastAPI, PostgreSQL, the CMS, and the viewer are
separate runtime containers but the backend is one cohesive application with
clear internal modules. If traffic or team ownership requires it later, the
content API, artwork service, publish worker, and catalogue delivery can be
split into microservices behind the same contracts. Keeping those boundaries
inside one codebase first avoids distributed-system complexity before it is
needed.

## Run It

Requirements: Docker Desktop with Compose.

```sh
docker compose up --build
```

- Viewer: http://localhost:4174
- CMS: http://localhost:4173
- API: http://localhost:8000/docs

Demo tokens use the defaults in `.env.example`:

- Editor: `peblo-editor-token`
- Admin: `peblo-admin-token`

The CMS login screen also provides these local demo-token buttons. Do not use
these defaults outside local development; set strong values through environment
secrets in a deployed environment.

The seed import is idempotent. It imports the 95 supplied rows and retains the
deliberate data problems in the validation workflow. The seed command creates a
bootstrap catalogue from published seed rows so the viewer has content
immediately. Open the CMS first, use the admin token, review the validation
report, resolve the remaining blockers, and publish to replace that bootstrap
file. Invalid samples demonstrate the server-side error messages.

## Structure

```text
backend/app/       FastAPI modular monolith and domain services
backend/tests/     focused API and publishing tests
cms/               internal editorial React application
viewer/            published-catalogue React application
assets/            challenge artwork samples
```

The viewer only calls `/catalog` and `/catalog/search`. Admin endpoints require
bearer authentication; only the admin role can publish.

## Decisions

- Publishing writes a complete temporary file, flushes it, and atomically
  replaces the live catalogue. A process dying before replacement leaves the
  previous catalogue intact; a failure after replacement leaves a complete new
  catalogue. Publish runs record success, blocked validation, or failure.
- Local filesystem storage implements a small storage interface. Moving to
  Cloudflare R2 requires replacing that adapter with R2 `put/get URL/delete`
  operations and configuring credentials; API and domain code do not change.
- Search reads the pre-published JSON and is appropriate for this small
  catalogue. At large catalogue sizes it should move to a search index or
  PostgreSQL full-text search, with pagination and ranking.
- A published file makes viewer reads fast, cacheable, and independent from CMS
  database load. The trade-off is that edits are invisible until a successful
  publish and the file must be rebuilt atomically.
- Season `0` is reserved for trailers and is excluded from normal season lists.
  Episodes sharing `content_group` collapse into one entry with available
  languages.

## Verification

```sh
pip install -e "./backend[test]"
python -m pytest -q
cd cms && npm ci && npm run build
cd ../viewer && npm ci && npm run build
```

CI runs Python compilation/tests, both frontend builds, and Docker image builds.
The production deploy step is intentionally not connected to a cloud account;
the image build output is ready to publish to a registry and deploy through a
managed container platform with secrets supplied by its secret manager.

## Scope

Versioned catalogue rollback, dry-run diffs, audit history, video streaming, and
production object storage are intentionally left out of this take-home version.
The core publish path and editor-facing validation were prioritized first.

AI assistance was used for scaffolding and review prompts. Generated code was
checked against the API contract, import-compiled, tested, and manually reviewed;
the final structure and publishing/storage decisions were kept only where they
matched the requirements.
