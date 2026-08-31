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

### Roles

- **Editor**: can create, view, edit, delete, and upload artwork for shows,
  seasons, and episodes. The CMS hides the release desk from editors.
- **Admin**: has all editor permissions plus validation reports, publish access,
  and publish-run history.

The API returns the authenticated role from `/auth/me` and enforces the same
permissions server-side. The UI distinction is convenience, not security.

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

## Deployment

The intended production shape is three immutable containers: the API, CMS, and
viewer, backed by managed PostgreSQL and object storage. Build each image from a
commit SHA, push it to a private registry, and deploy the images through the
platform's release mechanism. Put the CMS and viewer behind the same ingress as
the API, restrict database access to the API network, and configure the frontend
build argument `VITE_API_BASE` to the public API URL.

Before a rollout, provision the database and run the schema initialization job,
then run the seed/import job once if this is a new environment. Inject
`DATABASE_URL`, `EDITOR_TOKEN`, `ADMIN_TOKEN`, `ALLOWED_ORIGINS`,
`STORAGE_DIR`, and `CATALOG_PATH` through the platform secret/configuration
store. Do not use the demo credentials in production. For R2 or S3, replace
`LocalStorage` with an adapter using versioned objects and a current-catalogue
pointer; all API and catalogue code should retain the same storage contract.

For the included container image, the database migration command is
`python -m alembic -c alembic.ini upgrade head`; Compose runs it before the
idempotent seed command. Existing databases created by the original prototype
should be backed up and migrated in a staging environment before upgrading.

Configure `/health/live` as the liveness probe and `/health/ready` as the
readiness probe. Roll out the API only after readiness succeeds, then roll out
the static UIs. After deployment, verify the public viewer, `/catalog`, an
authenticated CMS request, and one artwork URL. Alert on repeated readiness
failures, catalogue-read failures, or failed publish runs because they indicate
either viewer downtime or stale editorial content.

Keep database backups and retain the last known-good catalogue object. A failed
publish must leave the previous catalogue active. For an emergency rollback,
redeploy the previous image SHA and restore the previous catalogue pointer;
database migrations should use an expand/contract process and be rolled forward
rather than destructively downgraded.

### Render Bootstrap

The repository includes `render.yaml` for a generic Render deployment. In the
Render dashboard, create a Blueprint from this repository, then enter strong
values for `EDITOR_TOKEN` and `ADMIN_TOKEN` when prompted. The Blueprint creates
the API, CMS, viewer, PostgreSQL database, and a persistent API storage disk.
After the first deploy, confirm the generated service hostnames match the
`VITE_API_BASE` and `ALLOWED_ORIGINS` values in `render.yaml`; update those
values if Render assigns different names and redeploy the two frontend services.
The API command runs Alembic, imports the seed data idempotently, and starts
only after the database is reachable. The CMS is available at the CMS service
URL and the public viewer at the viewer service URL.

## Scope

Versioned catalogue rollback, dry-run diffs, audit history, video streaming, and
production object storage are intentionally left out of this take-home version.
The core publish path and editor-facing validation were prioritized first.

AI assistance was used for scaffolding and review prompts. Generated code was
checked against the API contract, import-compiled, tested, and manually reviewed;
the final structure and publishing/storage decisions were kept only where they
matched the requirements.
