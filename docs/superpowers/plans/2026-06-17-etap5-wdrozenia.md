# Etap 5 — Wdrożenia na środowiska (CD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować przepływ Continuous Delivery, który promuje ten sam obraz GHCR (po SHA) przez ephemeral środowiska dev → staging → production w GitHub Actions, z konfiguracją per środowisko i smoke testem po każdym wdrożeniu.

**Architecture:** Nowy compose oparty na `image:` (zamiast `build:` z Etapu 4) podnosi pełny stack z obrazu pobranego z GHCR. Workflow `cd.yml` używa GitHub Environments dla sekretów/zmiennych i approval gate; każdy deploy = `compose pull → up → smoke-test.sh → down`. Backend zyskuje konsumpcję `SEED_ON_START` (dev/staging seedują, prod czysty); `LOG_LEVEL` jest przekazywany jako env var (realnie konsumowany dopiero w Etapie 6).

**Tech Stack:** Docker Compose, GitHub Actions, GitHub Environments, GHCR, Vitest (testy backendu), sh.

## Global Constraints

- Model wdrożenia: **ephemeral w CI** — `compose pull → up → smoke → down`; nic nie żyje poza pipeline'em.
- Promowany artefakt: **ten sam obraz GHCR po SHA** (build once, deploy many); deploy nigdy nie buduje obrazu.
- Trigger: `main` → dev + staging (auto, sekwencyjnie, **dopiero po udanym CI**); tag `v*` → production (approval gate).
- Sekrety i zmienne **wyłącznie w GitHub Environments** — nigdy w repo.
- Kod aplikacji, kontrakt API i strategia testów funkcjonalnych **bez zmian** (poza konsumpcją `SEED_ON_START`).
- Tag obrazu = 7-znakowy SHA (`${HEAD_SHA:0:7}`), spójny z `type=sha,prefix=` z Etapu 4 (`ci.yml` job `docker` — `type=sha` daje też 7-znakowy short SHA, ten sam string). Dla ścieżki `main` SHA pochodzi z `github.event.workflow_run.head_sha`; dla tagu `v*` z `github.sha`.
- Backend: ESM, `type: module`, importy z rozszerzeniem `.js`. Testy: Vitest, pliki w `backend/src/__tests__/`.
- Spec źródłowy: [../specs/2026-06-17-etap5-wdrozenia-design.md](../specs/2026-06-17-etap5-wdrozenia-design.md).

---

## File Structure

- `backend/src/services/seedProfile.ts` — **modyfikacja**: dodać `shouldSeedOnStart(env)` (czysta, testowalna funkcja decyzji).
- `backend/src/__tests__/seed.spec.ts` — **modyfikacja**: testy `shouldSeedOnStart`.
- `backend/src/index.ts` — **modyfikacja**: po `connectDb()` warunkowo wywołać `seedDemoProfile()`.
- `docker-compose.deploy.yml` — **nowy**: stack z `image:` (GHCR), parametryzowany env varami.
- `scripts/smoke-test.sh` — **nowy**: health + curl po deployu.
- `.github/workflows/cd.yml` — **nowy**: deploy dev+staging (main) i production (tag `v*`).
- `requirements.md` — **modyfikacja**: 2.4 link do specu/planu, blok „Decyzje — Etap 5".

---

### Task 1: Backend konsumuje `SEED_ON_START`

**Files:**
- Modify: `backend/src/services/seedProfile.ts`
- Test: `backend/src/__tests__/seed.spec.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes: `seedDemoProfile()` (istnieje), `connectDb()`/`disconnectDb()` z `./db/connection.js`.
- Produces: `shouldSeedOnStart(env?: NodeJS.ProcessEnv): boolean` — eksportowana z `seedProfile.ts`; `true` wtw. gdy `env.SEED_ON_START === 'true'`.

- [ ] **Step 1: Dopisz failing test dla `shouldSeedOnStart`**

W `backend/src/__tests__/seed.spec.ts` dodaj (góra pliku zawiera już import z `../services/seedProfile.js`; rozszerz import o `shouldSeedOnStart`):

```ts
import { describe, it, expect } from 'vitest'
import { shouldSeedOnStart } from '../services/seedProfile.js'

describe('shouldSeedOnStart', () => {
  it('zwraca true gdy SEED_ON_START === "true"', () => {
    expect(shouldSeedOnStart({ SEED_ON_START: 'true' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('zwraca false gdy zmienna nieustawiona', () => {
    expect(shouldSeedOnStart({} as NodeJS.ProcessEnv)).toBe(false)
  })

  it('zwraca false dla innych wartości niż "true"', () => {
    expect(shouldSeedOnStart({ SEED_ON_START: 'false' } as NodeJS.ProcessEnv)).toBe(false)
    expect(shouldSeedOnStart({ SEED_ON_START: '1' } as NodeJS.ProcessEnv)).toBe(false)
  })
})
```

> Jeśli `seed.spec.ts` już importuje `describe/it/expect`, nie duplikuj importu — dodaj tylko brakujący `shouldSeedOnStart`.

- [ ] **Step 2: Uruchom test — ma nie przejść**

Run: `cd backend && npm test -- src/__tests__/seed.spec.ts`
Expected: FAIL — `shouldSeedOnStart is not a function` / brak eksportu.

- [ ] **Step 3: Zaimplementuj `shouldSeedOnStart`**

W `backend/src/services/seedProfile.ts` dodaj na końcu pliku:

```ts
// Decyzja środowiskowa (Etap 5): dev/staging seedują, prod startuje czysty.
export function shouldSeedOnStart(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SEED_ON_START === 'true'
}
```

- [ ] **Step 4: Uruchom test — ma przejść**

Run: `cd backend && npm test -- src/__tests__/seed.spec.ts`
Expected: PASS (3 nowe testy zielone).

- [ ] **Step 5: Podłącz konsumpcję w bootstrapie**

W `backend/src/index.ts` zmień importy i `main()`:

```ts
import { createApp } from './app.js'
import { connectDb, disconnectDb } from './db/connection.js'
import { seedDemoProfile, shouldSeedOnStart } from './services/seedProfile.js'

const port = Number(process.env.PORT ?? 3001)

async function main() {
  await connectDb()
  if (shouldSeedOnStart()) {
    await seedDemoProfile()
    console.log('SEED_ON_START=true → demo profile upserted')
  }
  const server = createApp().listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`)
  })
  // ... reszta (shutdown) bez zmian
```

> Zostaw blok `shutdown` i `process.on(...)` dokładnie jak był.

- [ ] **Step 6: Type-check + pełne testy backendu**

Run: `cd backend && npm run type-check && npm run test:coverage`
Expected: PASS — type-check czysty, wszystkie testy (w tym integracyjne Testcontainers) zielone.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/seedProfile.ts backend/src/__tests__/seed.spec.ts backend/src/index.ts
git commit -m "feat(backend): honor SEED_ON_START env flag on bootstrap"
```

---

### Task 2: Compose wdrożeniowy oparty na obrazie GHCR

**Files:**
- Create: `docker-compose.deploy.yml`

**Interfaces:**
- Consumes: obrazy `ghcr.io/<owner>/teamable-backend` i `-frontend` (publikowane przez `ci.yml` job `docker`), env vary `IMAGE_OWNER`, `IMAGE_TAG`, `LOG_LEVEL`, `SEED_ON_START`, `FRONTEND_PORT`.
- Produces: plik `docker-compose.deploy.yml` używany przez `smoke-test.sh` i `cd.yml`.

- [ ] **Step 1: Utwórz `docker-compose.deploy.yml`**

```yaml
services:
  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ghcr.io/${IMAGE_OWNER}/teamable-backend:${IMAGE_TAG}
    environment:
      MONGODB_URI: mongodb://mongo:27017/teamable
      PORT: "3000"
      LOG_LEVEL: ${LOG_LEVEL:-info}
      SEED_ON_START: ${SEED_ON_START:-false}
    volumes:
      - uploads:/app/data/uploads
    depends_on:
      mongo:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    image: ghcr.io/${IMAGE_OWNER}/teamable-frontend:${IMAGE_TAG}
    ports:
      - "${FRONTEND_PORT:-8080}:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  mongo-data:
  uploads:
```

- [ ] **Step 2: Zweryfikuj poprawność składni compose**

Run: `IMAGE_OWNER=x IMAGE_TAG=y docker compose -f docker-compose.deploy.yml config -q`
Expected: brak outputu, exit 0 (interpolacja zmiennych i składnia OK).

- [ ] **Step 3: Commit**

```bash
git add docker-compose.deploy.yml
git commit -m "feat(cd): image-based deploy compose pulling from GHCR"
```

---

### Task 3: Smoke test wdrożonego stacku

**Files:**
- Create: `scripts/smoke-test.sh`

**Interfaces:**
- Consumes: argument `$1` = base URL (np. `http://localhost:8081`).
- Produces: skrypt `scripts/smoke-test.sh` (exit 0 = OK, ≠0 = fail) używany w `cd.yml`.

- [ ] **Step 1: Utwórz `scripts/smoke-test.sh`**

```sh
#!/bin/sh
set -e
BASE="${1:-http://localhost:8080}"

echo "Smoke: backend health"
curl -fsS "$BASE/api/health" | grep -q '"status":"ok"'

echo "Smoke: frontend serwuje SPA"
curl -fsS "$BASE/" | grep -q 'id="app"'

echo "Smoke OK ($BASE)"
```

- [ ] **Step 2: Nadaj prawa wykonania**

Run: `chmod +x scripts/smoke-test.sh`

- [ ] **Step 3: Zweryfikuj składnię skryptu**

Run: `sh -n scripts/smoke-test.sh && echo OK`
Expected: `OK` (brak błędów składni sh).

- [ ] **Step 4: (Opcjonalna) próba end-to-end lokalnie**

> Wymaga obrazów w GHCR; jeśli niedostępne lokalnie, pomiń — pełna weryfikacja nastąpi w `cd.yml`. Jeśli masz obrazy:
> ```bash
> IMAGE_OWNER=<owner> IMAGE_TAG=latest FRONTEND_PORT=8081 \
>   docker compose -p teamable_dev -f docker-compose.deploy.yml up -d
> ./scripts/smoke-test.sh http://localhost:8081
> docker compose -p teamable_dev -f docker-compose.deploy.yml down -v
> ```
> Expected: `Smoke OK (http://localhost:8081)`.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-test.sh
git commit -m "feat(cd): post-deploy smoke test (health + SPA)"
```

---

### Task 4: Workflow CD (dev + staging na main, prod na tagu)

**Files:**
- Create: `.github/workflows/cd.yml`

**Interfaces:**
- Consumes: `docker-compose.deploy.yml`, `scripts/smoke-test.sh`, GitHub Environments `dev`/`staging`/`production` (variables: `LOG_LEVEL`, `SEED_ON_START`, `FRONTEND_PORT`).
- Produces: workflow uruchamiany na `push` do `main` i na tagi `v*`.

> **Wymóg manualny (poza kodem):** w Settings → Environments utworzyć `dev`, `staging`, `production`; ustawić variables jak w spec sekcja 3; na `production` włączyć **Required reviewers**. To warunek działania approval gate — opisane w DoD.

> **KRYTYCZNE — wyścig CD vs build obrazu:** `ci.yml` i `cd.yml` triggerują się na ten sam `push` do `main` JEDNOCZEŚNIE. Obraz GHCR (po SHA) jest publikowany przez `ci.yml` job `docker`, który ma `needs: [frontend, backend, e2e]` i rusza dopiero PO przejściu testów. Gdyby `cd.yml` startował na własnym `push`, `compose pull` próbowałby pobrać jeszcze-nieistniejący tag → fail. Dlatego ścieżka `main` jest triggerowana przez `workflow_run` (po pomyślnym CI), a nie przez `push`. Ścieżka prod (`tag v*`) zostaje na `push`: tag wskazuje commit, który wcześniej przeszedł CI na `main`, więc obraz po jego SHA już istnieje w GHCR (model „build once, deploy many").

- [ ] **Step 1: Utwórz `.github/workflows/cd.yml`**

```yaml
name: cd

on:
  # Ścieżka main → dev+staging: dopiero PO udanym CI (które pushuje obraz do GHCR).
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
  # Ścieżka prod: tag v* wskazuje commit już zbudowany na main → obraz po SHA istnieje.
  push:
    tags: ["v*"]

jobs:
  resolve:
    # Dla workflow_run liczymy SHA z head_sha triggerującego runu CI; dla push (tag) z GITHUB_SHA.
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.t.outputs.tag }}
    steps:
      - id: t
        env:
          HEAD_SHA: ${{ github.event.workflow_run.head_sha || github.sha }}
        run: echo "tag=${HEAD_SHA:0:7}" >> "$GITHUB_OUTPUT"

  deploy-dev:
    # Tylko gdy CI zakończyło się sukcesem na main (workflow_run.conclusion == success).
    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success'
    needs: resolve
    environment: dev
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Deploy + smoke (dev)
        env:
          IMAGE_OWNER: ${{ github.repository_owner }}
          IMAGE_TAG: ${{ needs.resolve.outputs.tag }}
          LOG_LEVEL: ${{ vars.LOG_LEVEL }}
          SEED_ON_START: ${{ vars.SEED_ON_START }}
          FRONTEND_PORT: ${{ vars.FRONTEND_PORT }}
        run: |
          set -e
          docker compose -p teamable_dev -f docker-compose.deploy.yml pull
          docker compose -p teamable_dev -f docker-compose.deploy.yml up -d --wait
          ./scripts/smoke-test.sh "http://localhost:${FRONTEND_PORT}"
      - name: Teardown (dev)
        if: always()
        run: docker compose -p teamable_dev -f docker-compose.deploy.yml down -v

  deploy-staging:
    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success'
    needs: [resolve, deploy-dev]
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Deploy + smoke (staging)
        env:
          IMAGE_OWNER: ${{ github.repository_owner }}
          IMAGE_TAG: ${{ needs.resolve.outputs.tag }}
          LOG_LEVEL: ${{ vars.LOG_LEVEL }}
          SEED_ON_START: ${{ vars.SEED_ON_START }}
          FRONTEND_PORT: ${{ vars.FRONTEND_PORT }}
        run: |
          set -e
          docker compose -p teamable_staging -f docker-compose.deploy.yml pull
          docker compose -p teamable_staging -f docker-compose.deploy.yml up -d --wait
          ./scripts/smoke-test.sh "http://localhost:${FRONTEND_PORT}"
      - name: Teardown (staging)
        if: always()
        run: docker compose -p teamable_staging -f docker-compose.deploy.yml down -v

  deploy-prod:
    if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')
    needs: resolve
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Deploy + smoke (production)
        env:
          IMAGE_OWNER: ${{ github.repository_owner }}
          IMAGE_TAG: ${{ needs.resolve.outputs.tag }}
          LOG_LEVEL: ${{ vars.LOG_LEVEL }}
          SEED_ON_START: ${{ vars.SEED_ON_START }}
          FRONTEND_PORT: ${{ vars.FRONTEND_PORT }}
        run: |
          set -e
          docker compose -p teamable_production -f docker-compose.deploy.yml pull
          docker compose -p teamable_production -f docker-compose.deploy.yml up -d --wait
          ./scripts/smoke-test.sh "http://localhost:${FRONTEND_PORT}"
      - name: Teardown (production)
        if: always()
        run: docker compose -p teamable_production -f docker-compose.deploy.yml down -v
```

> `up -d --wait` blokuje aż wszystkie healthchecki (mongo, backend) będą zdrowe — eliminuje wyścigi przed smoke testem. Frontend nie ma healthchecku, ale zależy od zdrowego backendu.

- [ ] **Step 2: Walidacja workflow przez actionlint**

Run: `docker run --rm -v "$(pwd):/repo" --workdir /repo rhysd/actionlint:latest -color`
Expected: brak błędów dla `.github/workflows/cd.yml`. (Jeśli `actionlint` jest zainstalowany lokalnie, użyj `actionlint .github/workflows/cd.yml`.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/cd.yml
git commit -m "feat(cd): deploy workflow with GitHub Environments and approval gate"
```

---

### Task 5: Aktualizacja `requirements.md`

**Files:**
- Modify: `requirements.md`

**Interfaces:**
- Consumes: spec Etapu 5, ten plan.
- Produces: zaktualizowana tabela 2.4 i blok decyzji 30–37.

- [ ] **Step 1: Dodaj wiersz do tabeli 2.4**

W sekcji 2.4 (tabela „Etap | Spec | Plan implementacji") dodaj po wierszu Etapu 4:

```markdown
| 5 — Wdrożenia | [2026-06-17-etap5-wdrozenia-design.md](docs/superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) | [2026-06-17-etap5-wdrozenia.md](docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md) |
```

- [ ] **Step 2: Dodaj blok decyzji Etap 5**

W sekcji 8.1, po bloku „Decyzje — Etap 4", dodaj:

```markdown
#### Decyzje — Etap 5 (Wdrożenia / CD)

| # | Temat | Decyzja |
|---|-------|---------|
| 30 | Cel wdrożenia | **Ephemeral w CI**: `compose pull` → `up` → smoke → `down`; nic nie żyje poza pipeline'em. |
| 31 | Trigger CD | `main` → dev + staging (auto, sekwencyjnie, przez `workflow_run` po udanym CI — eliminuje wyścig z buildem obrazu); tag `v*` → production (approval gate). |
| 32 | Promowany artefakt | **Ten sam obraz GHCR po SHA** (build once, deploy many); deploy nigdy nie buduje. |
| 33 | Sekrety i zmienne | **GitHub Environments** (dev/staging/production); required reviewers na production. |
| 34 | Dane per środowisko | dev/staging: `SEED_ON_START=true` (seed demo); production: czysty start (FR-9). |
| 35 | Flagi runtime | `LOG_LEVEL` per środowisko (konsumowane w Etapie 6); `SEED_ON_START` on/off. |
| 36 | Izolacja środowisk | Osobne compose project (`teamable_dev`/`_staging`/`_production`), różne porty. |
| 37 | Smoke test | `/api/health` + curl frontendu po każdym deployu; błąd czerwieni job. |
```

- [ ] **Step 3: Commit**

```bash
git add requirements.md
git commit -m "docs: link Etap 5 spec/plan and record decisions 30-37"
```

---

## Self-Review

- **Spec coverage:** Decyzje 30–37 → Tasks: 30/31/32/36/37 (Task 2 compose + Task 4 workflow + Task 3 smoke), 33 (Task 4 Environments + wymóg manualny), 34/35 (Task 1 + Task 2 env). DoD spec sekcja 10: deploy compose (T2), Environments+approval (T4), cd.yml triggery (T4), smoke (T3), SEED_ON_START (T1), requirements (T5). ✅
- **Placeholder scan:** Brak TBD/„handle errors"; każdy krok ma realny kod/komendę. Krok 4 Task 3 jawnie oznaczony jako opcjonalny (zależny od obrazów w GHCR), nie placeholder. ✅
- **Type consistency:** `shouldSeedOnStart(env)` zdefiniowana w Task 1 i tam konsumowana; nazwy env (`IMAGE_OWNER`, `IMAGE_TAG`, `LOG_LEVEL`, `SEED_ON_START`, `FRONTEND_PORT`) identyczne w Task 2 i Task 4. ✅
- **Świadome ograniczenie:** `LOG_LEVEL` jest przekazywane (Task 2/4), ale realnie konsumowane dopiero w Etapie 6 (pino). Odnotowane w Global Constraints i decyzji 35.
