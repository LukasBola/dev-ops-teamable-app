# Etap 4 — Konteneryzacja (Docker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the backend (Node) and frontend (nginx) into lightweight multi-stage Docker images, wire them with MongoDB into one prod-like `docker compose` stack, and publish images to GHCR from CI.

**Architecture:** Two multi-stage Dockerfiles (builder → runtime) produce slim images with no devDependencies or source. A root `docker-compose.yml` runs `mongo + backend + frontend`, where nginx serves static files and reverse-proxies `/api/` to the backend; only the frontend exposes a host port. A new CI job builds both images on every PR and pushes them to GitHub Container Registry on `main`.

**Tech Stack:** Docker (multi-stage builds, BuildKit), docker compose, nginx:1.27-alpine, node:20-alpine, GitHub Actions (`docker/build-push-action`, `docker/metadata-action`, `docker/login-action`), GHCR.

**Spec:** [../specs/2026-06-11-etap4-docker-design.md](../specs/2026-06-11-etap4-docker-design.md)

---

## Prerequisites (READ FIRST)

This plan **depends on Etap 3 (MongoDB) being implemented and merged into `main`**. Before executing any task here, the backend must already provide:

- `backend/scripts/migrate.cjs` — migrate-mongo runner invoked as `node scripts/migrate.cjs up`.
- `backend/migrations/` — directory with at least one `.cjs` migration.
- `MONGODB_URI` environment variable consumed by `backend/src/db/connection.ts` and `migrate.cjs`.
- `GET /api/health` that returns `200 {"status":"ok"}` only when the Mongo connection is live, otherwise `503` (used by the container `HEALTHCHECK` and compose `depends_on: service_healthy`).
- `backend/src/index.ts` calling `await connectDb()` before `listen()` with graceful shutdown on `SIGTERM`/`SIGINT`.

**Verification gate before starting:** run these and confirm they exist.

```bash
cd /Users/lukaszbola/Documents/techworld/teamable
test -f backend/scripts/migrate.cjs && echo "migrate.cjs OK" || echo "MISSING migrate.cjs — Etap 3 not done"
test -d backend/migrations && echo "migrations/ OK" || echo "MISSING migrations/ — Etap 3 not done"
grep -q 'isDbConnected\|readyState' backend/src/app.ts && echo "DB-aware health OK" || echo "MISSING DB health — Etap 3 not done"
```

If any line reports MISSING, stop and implement Etap 3 first ([../plans/2026-06-11-etap3-mongodb.md](2026-06-11-etap3-mongodb.md)).

## Conventions for this plan

- **No classic unit tests.** Docker artifacts are verified with build + run + `curl` smoke checks that have concrete expected output. Each task's "failing" step confirms the artifact is absent/broken before you create it; the "passing" step confirms it works.
- **Commit messages:** Conventional Commits, lowercase subject start (commitlint enforces this — `chore(etap4): add backend dockerfile`, not `chore(etap4): Add...`).
- **Working directory:** repository root `/Users/lukaszbola/Documents/techworld/teamable` unless a step says otherwise.
- **Docker required:** Docker Desktop must be running for every task.

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/Dockerfile` | Multi-stage build of the backend runtime image (compile TS → slim node image) |
| `backend/docker-entrypoint.sh` | Container entrypoint: run migrations, then exec the server |
| `backend/.dockerignore` | Keep build context small; exclude `node_modules`, `dist`, secrets |
| `frontend/Dockerfile` | Multi-stage build: vite build → nginx static image |
| `frontend/nginx.conf` | Serve SPA static files + reverse-proxy `/api/` to backend |
| `frontend/.dockerignore` | Keep build context small |
| `docker-compose.yml` (root) | Full prod-like stack: mongo + backend + frontend, healthchecks, volumes |
| `.github/workflows/ci.yml` | New `docker` job: build (PR) + push to GHCR (main) |
| `README.md` (root) | Document `docker compose up` workflow |

`backend/docker-compose.yml` (Etap 3, mongo-only) stays unchanged. `requirements.md` (2.4 link + Etap 4 decisions) was already updated in the spec commit — no task here.

---

### Task 1: Backend image (Dockerfile + entrypoint + .dockerignore)

**Files:**
- Create: `backend/.dockerignore`
- Create: `backend/docker-entrypoint.sh`
- Create: `backend/Dockerfile`

- [ ] **Step 1: Confirm the image does not build yet (failing state)**

Run:
```bash
cd /Users/lukaszbola/Documents/techworld/teamable
docker build -t teamable-backend ./backend
```
Expected: FAIL — `failed to read dockerfile: open Dockerfile: no such file or directory` (no Dockerfile yet).

- [ ] **Step 2: Create `backend/.dockerignore`**

```
node_modules
dist
.git
*.md
.env*
coverage
data
```

- [ ] **Step 3: Create `backend/docker-entrypoint.sh`**

```sh
#!/bin/sh
set -e
node scripts/migrate.cjs up
exec node dist/index.js
```

- [ ] **Step 4: Create `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations
COPY scripts/migrate.cjs ./scripts/migrate.cjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && mkdir -p data/uploads && chown -R app:app /app
USER app
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
```

- [ ] **Step 5: Build the image and verify it succeeds**

Run:
```bash
docker build -t teamable-backend ./backend
```
Expected: PASS — ends with `naming to docker.io/library/teamable-backend`. (`tsc` runs in the builder stage; if it fails, Etap 3 code has a type error — fix that, not this plan.)

- [ ] **Step 6: Verify image contents, non-root user, and entrypoint wiring**

Run:
```bash
docker run --rm --entrypoint sh teamable-backend -c 'whoami && ls dist/index.js scripts/migrate.cjs docker-entrypoint.sh && ls migrations'
```
Expected: prints `app` (non-root), lists `dist/index.js`, `scripts/migrate.cjs`, `docker-entrypoint.sh`, and at least one migration file. (Full runtime/migration behaviour is verified in Task 3 where Mongo is available.)

- [ ] **Step 7: Commit**

```bash
git add backend/.dockerignore backend/docker-entrypoint.sh backend/Dockerfile
git commit -m "chore(etap4): add backend multi-stage dockerfile and entrypoint"
```

---

### Task 2: Frontend image (Dockerfile + nginx.conf + .dockerignore)

**Files:**
- Create: `frontend/.dockerignore`
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Confirm the image does not build yet (failing state)**

Run:
```bash
cd /Users/lukaszbola/Documents/techworld/teamable
docker build -t teamable-frontend ./frontend
```
Expected: FAIL — `open Dockerfile: no such file or directory`.

- [ ] **Step 2: Create `frontend/.dockerignore`**

```
node_modules
dist
.git
*.md
.env*
coverage
playwright-report
e2e
```

- [ ] **Step 3: Create `frontend/nginx.conf`**

```nginx
server {
  listen 80;

  location /api/ {
    proxy_pass http://backend:3000;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 4: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN chown -R app:app /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 5: Build the image and verify it succeeds**

Run:
```bash
docker build -t teamable-frontend ./frontend
```
Expected: PASS — ends with `naming to docker.io/library/teamable-frontend`.

- [ ] **Step 6: Run the container and verify it serves the SPA**

Run:
```bash
docker run -d --name tf-test -p 8080:80 teamable-frontend
sleep 2
curl -s http://localhost:8080/ | grep -o '<div id="app">' && echo "SPA served"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/some/deep/route
docker rm -f tf-test
```
Expected: prints `<div id="app">` then `SPA served`, and the deep-route request returns `200` (proves `try_files` SPA fallback). The `/api/` proxy is exercised in Task 3 (needs the backend service).

- [ ] **Step 7: Commit**

```bash
git add frontend/.dockerignore frontend/nginx.conf frontend/Dockerfile
git commit -m "chore(etap4): add frontend nginx dockerfile and proxy config"
```

---

### Task 3: Full stack `docker-compose.yml` (root)

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Confirm there is no root compose stack yet (failing state)**

Run:
```bash
cd /Users/lukaszbola/Documents/techworld/teamable
docker compose config
```
Expected: FAIL — `no configuration file provided: not found` (only `backend/docker-compose.yml` exists; root has none).

- [ ] **Step 2: Create root `docker-compose.yml`**

```yaml
services:
  mongo:
    image: mongo:7
    volumes:
      - teamable-mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
    environment:
      MONGODB_URI: mongodb://mongo:27017/teamable
      PORT: "3000"
    volumes:
      - teamable-uploads:/app/data/uploads
    depends_on:
      mongo:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build:
      context: ./frontend
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  teamable-mongo-data:
  teamable-uploads:
```

- [ ] **Step 3: Validate the compose file parses**

Run:
```bash
docker compose config >/dev/null && echo "compose valid"
```
Expected: prints `compose valid` (no YAML/schema errors).

- [ ] **Step 4: Bring up the full stack**

Run:
```bash
docker compose up --build -d
```
Expected: PASS — builds `backend` and `frontend`, pulls `mongo:7`, starts all three. Then wait for health:
```bash
# Wait until backend reports healthy (depends_on already gates frontend on it)
for i in $(seq 1 30); do
  docker compose ps --format '{{.Service}} {{.Health}}' | grep -q 'backend healthy' && break
  sleep 2
done
docker compose ps
```
Expected: `mongo`, `backend`, `frontend` all `running`; backend `healthy`.

- [ ] **Step 5: Verify the app is reachable and the API proxy works**

Run:
```bash
curl -s http://localhost:8080/ | grep -o '<div id="app">' && echo "frontend OK"
curl -s http://localhost:8080/api/health
echo
```
Expected: prints `<div id="app">`, `frontend OK`, then `{"status":"ok"}` (proves nginx `/api/` → `backend:3000` proxy and a live Mongo connection).

- [ ] **Step 6: Verify persistence round-trip and uploads volume**

Run:
```bash
# Write a profile through the proxied API
curl -s -X PUT http://localhost:8080/api/profile \
  -H 'Content-Type: application/json' \
  -d '{"firstName":"Docker","lastName":"Test","email":"docker@example.com","aboutMe":"compose"}' >/dev/null
# Restart backend only; data must survive (mongo volume) and migrations re-run idempotently
docker compose restart backend
for i in $(seq 1 30); do
  docker compose ps --format '{{.Service}} {{.Health}}' | grep -q 'backend healthy' && break
  sleep 2
done
curl -s http://localhost:8080/api/profile | grep -o '"firstName":"Docker"' && echo "persistence OK"
```
Expected: prints `"firstName":"Docker"` then `persistence OK` (data survived a backend restart; entrypoint migrations ran again without error).

- [ ] **Step 7: Tear down**

Run:
```bash
docker compose down
```
Expected: stops and removes the three containers; named volumes `teamable-mongo-data` and `teamable-uploads` remain (not removed without `-v`).

- [ ] **Step 8: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(etap4): add full-stack docker compose with healthchecks and volumes"
```

---

### Task 4: CI `docker` job (build on PR, push to GHCR on main)

**Files:**
- Modify: `.github/workflows/ci.yml` (append a new `docker` job after the existing `e2e` job, last in the file)

- [ ] **Step 1: Confirm there is no docker job yet (failing state)**

Run:
```bash
cd /Users/lukaszbola/Documents/techworld/teamable
grep -q '^  docker:' .github/workflows/ci.yml && echo "exists" || echo "no docker job yet"
```
Expected: prints `no docker job yet`.

- [ ] **Step 2: Append the `docker` job to `.github/workflows/ci.yml`**

Add this block at the end of the file (same indentation level as the existing `frontend:`, `backend:`, `e2e:` jobs — two spaces under `jobs:`):

```yaml
  docker:
    needs: [frontend, backend, e2e]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker meta — backend
        id: meta-backend
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/teamable-backend
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Docker meta — frontend
        id: meta-frontend
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository_owner }}/teamable-frontend
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ${{ steps.meta-backend.outputs.tags }}
          labels: ${{ steps.meta-backend.outputs.labels }}

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}
```

- [ ] **Step 3: Validate the workflow YAML is well-formed**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml OK')"
```
Expected: prints `yaml OK` (no parse error). Confirm the `docker` job is present:
```bash
grep -q '^  docker:' .github/workflows/ci.yml && echo "docker job present"
```
Expected: prints `docker job present`.

- [ ] **Step 4: Verify both build contexts succeed locally (mirrors the CI PR build)**

Run:
```bash
docker build -t teamable-backend ./backend && docker build -t teamable-frontend ./frontend && echo "both contexts build"
```
Expected: prints `both contexts build`. (CI runs the same `docker build` per context; the actual GHCR push only runs on `main` and is observed in the Actions run after merge.)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(etap4): build images on pr and push to ghcr on main"
```

---

### Task 5: Document the container workflow (README)

**Files:**
- Modify: `README.md` (root) — add a "Docker (Etap 4)" section

- [ ] **Step 1: Inspect the current root README to find a sensible insertion point**

Run:
```bash
cd /Users/lukaszbola/Documents/techworld/teamable
sed -n '1,40p' README.md
```
Expected: shows the README header/structure so you can append the new section without duplicating existing headings. (If no root `README.md` exists, create it with just the section below plus an H1 `# Teamable`.)

- [ ] **Step 2: Add the "Docker (Etap 4)" section to `README.md`**

Append:

```markdown
## Docker (Etap 4)

The whole app runs as a prod-like stack with one command (Docker Desktop must be running):

```bash
docker compose up --build      # mongo + backend + frontend (nginx)
```

- Open the app at http://localhost:8080 — nginx serves the SPA and reverse-proxies `/api/` to the backend.
- Only the frontend exposes a host port (`8080`); backend (`3000`) and Mongo (`27017`) are reachable only inside the compose network.
- Avatar files persist in the `teamable-uploads` volume; Mongo data in `teamable-mongo-data`. Both survive `docker compose down`.
- The backend container runs DB migrations on startup (`docker-entrypoint.sh`) before the server listens.

Stop and remove containers (keep data):

```bash
docker compose down
```

Wipe everything including volumes:

```bash
docker compose down -v
```

Dev without containerizing the app (hot reload, Mongo only):

```bash
docker compose -f backend/docker-compose.yml up -d   # just Mongo
# then run frontend/backend with npm run dev as usual
```

Images are published to GHCR from CI on `main`: `ghcr.io/<owner>/teamable-backend` and `ghcr.io/<owner>/teamable-frontend`, tagged with the commit SHA and `latest`.
```

- [ ] **Step 3: Verify the section renders and links are sane**

Run:
```bash
grep -q '## Docker (Etap 4)' README.md && grep -q 'localhost:8080' README.md && echo "readme section OK"
```
Expected: prints `readme section OK`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(etap4): document docker compose workflow in readme"
```

---

## Final verification (Definition of Done — Etap 4)

After all tasks, confirm the spec's DoD holds:

- [ ] `backend/Dockerfile` multi-stage, non-root `app`, `HEALTHCHECK /api/health`, `migrations/` + `scripts/migrate.cjs` + `docker-entrypoint.sh` in image — verified in Task 1.
- [ ] `frontend/Dockerfile` multi-stage → nginx, `nginx.conf` proxies `/api/` and SPA `try_files` — verified in Task 2.
- [ ] Root `docker-compose.yml` runs the full stack, `depends_on: service_healthy`, volumes, single host port `8080` — verified in Task 3.
- [ ] `backend/docker-compose.yml` (Etap 3, mongo-only) unchanged — confirm with `git status` (untouched).
- [ ] `docker compose up --build` serves the app at `localhost:8080`, migrations run at backend start, avatars persist — verified in Task 3 steps 5–6.
- [ ] CI `docker` job builds on PR, pushes to GHCR on `main`, gated on `frontend`+`backend`+`e2e` — added in Task 4; push observed in Actions after merging to `main`.
- [ ] `requirements.md` (2.4 link + Etap 4 decisions) — already committed with the spec; confirm with `git log --oneline -- requirements.md`.

Final combined check:

```bash
cd /Users/lukaszbola/Documents/techworld/teamable
docker compose up --build -d
for i in $(seq 1 30); do docker compose ps --format '{{.Service}} {{.Health}}' | grep -q 'backend healthy' && break; sleep 2; done
curl -s http://localhost:8080/api/health    # expect {"status":"ok"}
curl -s http://localhost:8080/ | grep -o '<div id="app">'   # expect the app root
docker compose down
```
