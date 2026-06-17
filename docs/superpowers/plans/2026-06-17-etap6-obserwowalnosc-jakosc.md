# Etap 6 — Obserwowalność i jakość — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać warstwę obserwowalności (structured logging pino, metryki prom-client, Prometheus + Grafana w compose) oraz domknąć bramy jakości w CI (coverage gate łamiący build + CodeQL + SonarCloud).

**Architecture:** Backend zyskuje moduł loggera (pino, `LOG_LEVEL` z env), middleware nadające `requestId` i logujące żądania, oraz middleware/route metryk eksponujące `GET /api/metrics` w formacie Prometheus. Stack compose rozszerzamy o `prometheus` (scrape backendu) i `grafana` (provisioning datasource + dashboard). CI: progi coverage w Vitest (backend + frontend) jako twarda brama, plus osobne workflow CodeQL i SonarCloud konsumujące raporty lcov.

**Tech Stack:** pino, prom-client, Express 5, Vitest + @vitest/coverage-v8, Prometheus, Grafana, GitHub Actions (CodeQL, SonarCloud scan action).

## Global Constraints

- Backend: ESM, `type: module`, importy z rozszerzeniem `.js`. Testy: Vitest, pliki w `backend/src/__tests__/`, `fileParallelism: false`.
- Logger czyta `process.env.LOG_LEVEL` (domyślnie `info`) — spina się z decyzją 35 Etapu 5.
- Metryki pod prefiksem `/api` (`GET /api/metrics`) — przechodzą przez istniejący nginx proxy z Etapu 4 bez nowej reguły.
- Prometheus + Grafana żyją w compose (dev/smoke), **nie** na trwałym prodzie (model ephemeral z Etapu 5).
- Coverage gate: start **70%** dla lines/functions/branches/statements; spadek poniżej łamie CI. Osobno backend i frontend.
- Format metryk Prometheus; histogram nazwany `http_request_duration_seconds` z labelami `method`, `route`, `status`.
- Funkcjonalność aplikacji i kontrakt API **bez zmian** — dochodzi instrumentacja.
- Spec źródłowy: [../specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md](../specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md).

---

## File Structure

- `backend/src/logger.ts` — **nowy**: instancja pino z `LOG_LEVEL`.
- `backend/src/middleware/requestLogger.ts` — **nowy**: middleware z `requestId` i logiem per żądanie.
- `backend/src/middleware/metrics.ts` — **nowy**: prom-client registry, histogram, middleware pomiaru.
- `backend/src/routes/metrics.ts` — **nowy**: `GET /api/metrics`.
- `backend/src/app.ts` — **modyfikacja**: podpiąć requestLogger, metrics middleware, route `/api/metrics`.
- `backend/src/__tests__/metrics.spec.ts` — **nowy**: test endpointu i instrumentacji.
- `backend/vitest.config.ts` — **modyfikacja**: progi coverage.
- `frontend/vitest.config.ts` — **modyfikacja**: progi coverage.
- `monitoring/prometheus.yml` — **nowy**: scrape config.
- `monitoring/grafana/provisioning/datasources/prometheus.yml` — **nowy**.
- `monitoring/grafana/provisioning/dashboards/dashboards.yml` — **nowy**.
- `monitoring/grafana/dashboards/teamable.json` — **nowy**: dashboard.
- `docker-compose.yml` — **modyfikacja**: usługi `prometheus` + `grafana`.
- `.github/workflows/codeql.yml` — **nowy**.
- `.github/workflows/sonarcloud.yml` — **nowy**.
- `sonar-project.properties` — **nowy**.
- `requirements.md` — **modyfikacja**: 2.4 link, sekcja 6, decyzje 38–43.

---

### Task 1: Structured logging (pino) + LOG_LEVEL

**Files:**
- Create: `backend/src/logger.ts`
- Test: `backend/src/__tests__/logger.spec.ts`

**Interfaces:**
- Produces: `logger` (instancja pino) oraz `resolveLevel(env?): string` z `logger.ts`. `resolveLevel` zwraca `env.LOG_LEVEL ?? 'info'`.

- [ ] **Step 1: Zainstaluj pino**

Run: `cd backend && npm install pino`
Expected: `pino` w `dependencies`.

- [ ] **Step 2: Dopisz failing test**

`backend/src/__tests__/logger.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveLevel } from '../logger.js'

describe('resolveLevel', () => {
  it('domyślnie "info"', () => {
    expect(resolveLevel({} as NodeJS.ProcessEnv)).toBe('info')
  })
  it('honoruje LOG_LEVEL', () => {
    expect(resolveLevel({ LOG_LEVEL: 'debug' } as NodeJS.ProcessEnv)).toBe('debug')
  })
})
```

- [ ] **Step 3: Uruchom — ma nie przejść**

Run: `cd backend && npm test -- src/__tests__/logger.spec.ts`
Expected: FAIL — brak modułu `../logger.js`.

- [ ] **Step 4: Zaimplementuj `logger.ts`**

`backend/src/logger.ts`:

```ts
import pino from 'pino'

export function resolveLevel(env: NodeJS.ProcessEnv = process.env): string {
  return env.LOG_LEVEL ?? 'info'
}

export const logger = pino({
  level: resolveLevel(),
  formatters: { level: (label) => ({ level: label }) },
})
```

- [ ] **Step 5: Uruchom — ma przejść**

Run: `cd backend && npm test -- src/__tests__/logger.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/logger.ts backend/src/__tests__/logger.spec.ts
git commit -m "feat(backend): pino structured logger with LOG_LEVEL"
```

---

### Task 2: Middleware requestId + log per żądanie

**Files:**
- Create: `backend/src/middleware/requestLogger.ts`
- Test: `backend/src/__tests__/requestLogger.spec.ts`

**Interfaces:**
- Consumes: `logger` z `../logger.js`.
- Produces: `requestLogger` — Express middleware `(req, res, next)`. Ustawia `res.locals.requestId` (UUID) i nagłówek `X-Request-Id`; loguje na `finish` metodę, ścieżkę, status, czas (ms).

- [ ] **Step 1: Dopisz failing test**

`backend/src/__tests__/requestLogger.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { requestLogger } from '../middleware/requestLogger.js'

describe('requestLogger', () => {
  it('dodaje nagłówek X-Request-Id do odpowiedzi', async () => {
    const app = express()
    app.use(requestLogger)
    app.get('/ping', (_req, res) => res.json({ ok: true }))

    const resp = await request(app).get('/ping')
    expect(resp.status).toBe(200)
    expect(resp.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/)
  })
})
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `cd backend && npm test -- src/__tests__/requestLogger.spec.ts`
Expected: FAIL — brak modułu `../middleware/requestLogger.js`.

- [ ] **Step 3: Zaimplementuj middleware**

`backend/src/middleware/requestLogger.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { logger } from '../logger.js'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID()
  res.locals.requestId = requestId
  res.setHeader('X-Request-Id', requestId)
  const start = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      'request completed',
    )
  })

  next()
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `cd backend && npm test -- src/__tests__/requestLogger.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requestLogger.ts backend/src/__tests__/requestLogger.spec.ts
git commit -m "feat(backend): requestId + per-request structured log middleware"
```

---

### Task 3: Metryki prom-client + endpoint /api/metrics

**Files:**
- Create: `backend/src/middleware/metrics.ts`
- Create: `backend/src/routes/metrics.ts`
- Test: `backend/src/__tests__/metrics.spec.ts`

**Interfaces:**
- Produces:
  - z `middleware/metrics.ts`: `registry` (prom-client `Registry`), `metricsMiddleware(req, res, next)` (mierzy czas i inkrementuje histogram), `httpDuration` (Histogram).
  - z `routes/metrics.ts`: `metricsRouter` (Express Router) obsługujący `GET /` → tekst metryk.

- [ ] **Step 1: Zainstaluj prom-client**

Run: `cd backend && npm install prom-client`
Expected: `prom-client` w `dependencies`.

- [ ] **Step 2: Dopisz failing test**

`backend/src/__tests__/metrics.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { metricsMiddleware } from '../middleware/metrics.js'
import { metricsRouter } from '../routes/metrics.js'

function buildApp() {
  const app = express()
  app.use(metricsMiddleware)
  app.get('/api/ping', (_req, res) => res.json({ ok: true }))
  app.use('/api/metrics', metricsRouter)
  return app
}

describe('metrics', () => {
  it('GET /api/metrics zwraca format Prometheus z histogramem', async () => {
    const app = buildApp()
    await request(app).get('/api/ping') // wygeneruj próbkę
    const resp = await request(app).get('/api/metrics')
    expect(resp.status).toBe(200)
    expect(resp.headers['content-type']).toContain('text/plain')
    expect(resp.text).toContain('http_request_duration_seconds')
    expect(resp.text).toContain('process_cpu_user_seconds_total') // default metrics
  })
})
```

- [ ] **Step 3: Uruchom — ma nie przejść**

Run: `cd backend && npm test -- src/__tests__/metrics.spec.ts`
Expected: FAIL — brak modułów.

- [ ] **Step 4: Zaimplementuj `middleware/metrics.ts`**

```ts
import type { Request, Response, NextFunction } from 'express'
import client from 'prom-client'

export const registry = new client.Registry()
client.collectDefaultMetrics({ register: registry })

export const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Czas obsługi żądania HTTP w sekundach',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3],
  registers: [registry],
})

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const end = httpDuration.startTimer()
  res.on('finish', () => {
    const route = req.route?.path ?? req.originalUrl.split('?')[0]
    end({ method: req.method, route, status: String(res.statusCode) })
  })
  next()
}
```

- [ ] **Step 5: Zaimplementuj `routes/metrics.ts`**

```ts
import { Router } from 'express'
import { registry } from '../middleware/metrics.js'

export const metricsRouter = Router()

metricsRouter.get('/', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType)
  res.send(await registry.metrics())
})
```

- [ ] **Step 6: Uruchom — ma przejść**

Run: `cd backend && npm test -- src/__tests__/metrics.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/middleware/metrics.ts backend/src/routes/metrics.ts backend/src/__tests__/metrics.spec.ts
git commit -m "feat(backend): prom-client metrics + /api/metrics endpoint"
```

---

### Task 4: Podpięcie instrumentacji w app.ts

**Files:**
- Modify: `backend/src/app.ts`
- Test: `backend/src/__tests__/metrics.spec.ts` (rozszerzenie o test przez realne `createApp`)

**Interfaces:**
- Consumes: `requestLogger`, `metricsMiddleware`, `metricsRouter`.
- Produces: `createApp()` z podpiętą instrumentacją; `/api/metrics` dostępne na realnej aplikacji.

- [ ] **Step 1: Dopisz failing test przez createApp**

Dodaj do `backend/src/__tests__/metrics.spec.ts`:

```ts
import { createApp } from '../app.js'

describe('createApp instrumentacja', () => {
  it('eksponuje /api/metrics i nagłówek X-Request-Id', async () => {
    const app = createApp()
    const health = await request(app).get('/api/health')
    expect(health.headers['x-request-id']).toMatch(/[0-9a-f-]{36}/)

    const metrics = await request(app).get('/api/metrics')
    expect(metrics.status).toBe(200)
    expect(metrics.text).toContain('http_request_duration_seconds')
  })
})
```

- [ ] **Step 2: Uruchom — ma nie przejść**

Run: `cd backend && npm test -- src/__tests__/metrics.spec.ts`
Expected: FAIL — `createApp` nie ustawia `X-Request-Id` / brak `/api/metrics`.

- [ ] **Step 3: Zmodyfikuj `app.ts`**

```ts
import express from 'express'
import cors from 'cors'
import { profileRouter } from './routes/profile.js'
import { metricsRouter } from './routes/metrics.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'
import { metricsMiddleware } from './middleware/metrics.js'
import { isDbConnected } from './db/connection.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use(requestLogger)
  app.use(metricsMiddleware)

  app.get('/api/health', (_req, res) => {
    if (isDbConnected()) res.json({ status: 'ok' })
    else res.status(503).json({ status: 'down' })
  })

  app.use('/api/metrics', metricsRouter)
  app.use('/api/profile', profileRouter)

  // Error-middleware must be registered last.
  app.use(errorHandler)

  return app
}
```

- [ ] **Step 4: Uruchom — ma przejść**

Run: `cd backend && npm test -- src/__tests__/metrics.spec.ts`
Expected: PASS.

- [ ] **Step 5: Pełne testy + type-check**

Run: `cd backend && npm run type-check && npm run test:coverage`
Expected: PASS — wszystkie testy zielone, type-check czysty.

- [ ] **Step 6: Commit**

```bash
git add backend/src/app.ts backend/src/__tests__/metrics.spec.ts
git commit -m "feat(backend): wire requestLogger + metrics into createApp"
```

---

### Task 5: Prometheus + Grafana w compose

**Files:**
- Create: `monitoring/prometheus.yml`
- Create: `monitoring/grafana/provisioning/datasources/prometheus.yml`
- Create: `monitoring/grafana/provisioning/dashboards/dashboards.yml`
- Create: `monitoring/grafana/dashboards/teamable.json`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: backend eksponujący `/api/metrics` (Task 4).
- Produces: usługi `prometheus` (`:9090`) i `grafana` (`:3001`) w stacku.

- [ ] **Step 1: `monitoring/prometheus.yml`**

```yaml
global:
  scrape_interval: 10s
scrape_configs:
  - job_name: teamable-backend
    metrics_path: /api/metrics
    static_configs:
      - targets: ["backend:3000"]
```

- [ ] **Step 2: Grafana datasource provisioning**

`monitoring/grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
```

- [ ] **Step 3: Grafana dashboard provider**

`monitoring/grafana/provisioning/dashboards/dashboards.yml`:

```yaml
apiVersion: 1
providers:
  - name: teamable
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

- [ ] **Step 4: Dashboard `monitoring/grafana/dashboards/teamable.json`**

```json
{
  "uid": "teamable",
  "title": "Teamable Backend",
  "timezone": "browser",
  "schemaVersion": 39,
  "panels": [
    {
      "type": "timeseries",
      "title": "Request rate (req/s)",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "targets": [
        {
          "expr": "sum(rate(http_request_duration_seconds_count[1m])) by (route)",
          "legendFormat": "{{route}}"
        }
      ]
    },
    {
      "type": "timeseries",
      "title": "p95 latency (s)",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "targets": [
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p95"
        }
      ]
    },
    {
      "type": "timeseries",
      "title": "Error rate (5xx)",
      "gridPos": { "h": 8, "w": 24, "x": 0, "y": 8 },
      "targets": [
        {
          "expr": "sum(rate(http_request_duration_seconds_count{status=~\"5..\"}[1m]))",
          "legendFormat": "5xx"
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: Dodaj usługi do `docker-compose.yml`**

Wstaw przed kluczem `volumes:` (po usłudze `frontend`):

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    ports:
      - "9090:9090"
    depends_on:
      backend:
        condition: service_healthy

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_AUTH_ANONYMOUS_ENABLED: "true"
      GF_AUTH_ANONYMOUS_ORG_ROLE: Admin
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "3001:3000"
    depends_on:
      - prometheus
```

- [ ] **Step 6: Walidacja compose + dashboardu JSON**

Run: `docker compose config -q && node -e "JSON.parse(require('fs').readFileSync('monitoring/grafana/dashboards/teamable.json','utf8')); console.log('JSON OK')"`
Expected: brak błędów compose; `JSON OK`.

- [ ] **Step 7: Weryfikacja end-to-end (lokalnie)**

Run:
```bash
docker compose up -d --build --wait
curl -fsS http://localhost:8080/api/metrics | grep -q http_request_duration_seconds && echo "metrics OK"
curl -fsS "http://localhost:9090/api/v1/targets" | grep -q '"health":"up"' && echo "prometheus scrape OK"
curl -fsS http://localhost:3001/api/health | grep -q ok && echo "grafana OK"
docker compose down -v
```
Expected: `metrics OK`, `prometheus scrape OK`, `grafana OK`.

> Jeśli scrape jeszcze nie zdążył (target `unknown`), odczekaj ~15 s i ponów `curl` targets.

- [ ] **Step 8: Commit**

```bash
git add monitoring docker-compose.yml
git commit -m "feat(observability): Prometheus scrape + Grafana dashboard in compose"
```

---

### Task 6: Coverage gate (backend + frontend)

**Files:**
- Modify: `backend/vitest.config.ts`
- Modify: `frontend/vitest.config.ts`

**Interfaces:**
- Produces: progi coverage łamiące build poniżej 70%.

- [ ] **Step 1: Backend — dodaj progi**

W `backend/vitest.config.ts`, w obiekcie `test`, dodaj klucz `coverage` (obok istniejących):

```ts
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
```

- [ ] **Step 2: Backend — zweryfikuj że gate działa**

Run: `cd backend && npm run test:coverage`
Expected: PASS jeśli pokrycie ≥70%. Jeśli FAIL z „coverage threshold not met" — dopisz brakujące testy lub (jeśli świadomie) obniż próg startowy i odnotuj w commicie. Nie obniżaj poniżej realnego pokrycia bez uzasadnienia.

- [ ] **Step 3: Frontend — dodaj progi**

W `frontend/vitest.config.ts`, wewnątrz `defineConfig({ test: { ... } })`, dodaj:

```ts
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
      },
```

- [ ] **Step 4: Frontend — zweryfikuj gate**

Run: `cd frontend && npm run test:unit:coverage`
Expected: PASS jeśli ≥70%; przy FAIL — jak w Step 2.

- [ ] **Step 5: Commit**

```bash
git add backend/vitest.config.ts frontend/vitest.config.ts
git commit -m "feat(quality): coverage thresholds (70%) as CI gate"
```

---

### Task 7: CodeQL workflow

**Files:**
- Create: `.github/workflows/codeql.yml`

**Interfaces:**
- Produces: workflow analizy CodeQL na push/PR/schedule.

- [ ] **Step 1: Utwórz `.github/workflows/codeql.yml`**

```yaml
name: codeql

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@v4
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

- [ ] **Step 2: Walidacja workflow**

Run: `docker run --rm -v "$(pwd):/repo" --workdir /repo rhysd/actionlint:latest -color`
Expected: brak błędów dla `codeql.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/codeql.yml
git commit -m "feat(quality): CodeQL static analysis workflow"
```

---

### Task 8: SonarCloud

**Files:**
- Create: `sonar-project.properties`
- Create: `.github/workflows/sonarcloud.yml`

**Interfaces:**
- Consumes: raporty lcov z Task 6 (`backend/coverage/lcov.info`, `frontend/coverage/lcov.info`), sekret `SONAR_TOKEN`.
- Produces: skan SonarCloud z quality gate.

> **Wymóg manualny:** projekt w SonarCloud (organizacja + projectKey), `SONAR_TOKEN` dodany do repo Secrets. Uzupełnij `<org>` i `<owner>` realnymi wartościami.

- [ ] **Step 1: Utwórz `sonar-project.properties`**

```properties
sonar.organization=<org>
sonar.projectKey=<owner>_teamable
sonar.sources=frontend/src,backend/src
sonar.tests=frontend/src,backend/src
# Pliki testowe należą do sonar.tests; te same wzorce wyłączamy z sonar.sources,
# żeby żaden plik nie był jednocześnie w sources i tests (inaczej skan Sonara faila
# z "file is in both sources and tests").
sonar.test.inclusions=**/*.spec.ts,**/*.test.ts,**/__tests__/**
sonar.exclusions=**/*.spec.ts,**/*.test.ts,**/__tests__/**
sonar.javascript.lcov.reportPaths=frontend/coverage/lcov.info,backend/coverage/lcov.info
```

- [ ] **Step 2: Utwórz `.github/workflows/sonarcloud.yml`**

```yaml
name: sonarcloud

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  sonar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Backend coverage
        working-directory: backend
        run: npm ci && npm run test:coverage

      - name: Frontend coverage
        working-directory: frontend
        run: npm ci && npm run test:unit:coverage

      - name: SonarCloud Scan
        uses: SonarSource/sonarqube-scan-action@v4
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

- [ ] **Step 3: Walidacja workflow**

Run: `docker run --rm -v "$(pwd):/repo" --workdir /repo rhysd/actionlint:latest -color`
Expected: brak błędów dla `sonarcloud.yml`.

- [ ] **Step 4: Commit**

```bash
git add sonar-project.properties .github/workflows/sonarcloud.yml
git commit -m "feat(quality): SonarCloud scan with lcov coverage import"
```

---

### Task 9: Aktualizacja `requirements.md`

**Files:**
- Modify: `requirements.md`

- [ ] **Step 1: Dodaj wiersz do tabeli 2.4**

Po wierszu Etapu 5:

```markdown
| 6 — Obserwowalność i jakość | [2026-06-17-etap6-obserwowalnosc-jakosc-design.md](docs/superpowers/specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md) | [2026-06-17-etap6-obserwowalnosc-jakosc.md](docs/superpowers/plans/2026-06-17-etap6-obserwowalnosc-jakosc.md) |
```

- [ ] **Step 2: Odnotuj coverage gate w sekcji 6**

Pod tabelą sekcji 6 (po „Zasady:") dodaj zdanie:

```markdown
> **Etap 6:** wprowadzono twardy próg pokrycia (70% lines/functions/branches/statements) jako bramę CI dla frontend i backend; spadek poniżej progu czerwieni pipeline.
```

- [ ] **Step 3: Dodaj blok decyzji Etap 6**

W sekcji 8.1, po bloku „Decyzje — Etap 5":

```markdown
#### Decyzje — Etap 6 (Obserwowalność i jakość)

| # | Temat | Decyzja |
|---|-------|---------|
| 38 | Logowanie | **pino** — structured JSON z `requestId`; `LOG_LEVEL` z env (per środowisko). |
| 39 | Metryki | **prom-client** — `GET /api/metrics` (default Node metrics + histogram latencji HTTP). |
| 40 | Stack monitoringu | **Prometheus + Grafana** jako usługi w compose (provisioning datasource + dashboard). |
| 41 | Coverage gate | **Vitest** próg 70% (frontend + backend); spadek łamie CI; raport lcov. |
| 42 | Analiza statyczna #1 | **CodeQL** (GitHub native) — bezpieczeństwo, wynik w zakładce Security. |
| 43 | Analiza statyczna #2 | **SonarCloud** — utrzymywalność, code smells, quality gate; konsumuje lcov. |
```

- [ ] **Step 4: Commit**

```bash
git add requirements.md
git commit -m "docs: link Etap 6 spec/plan and record decisions 38-43"
```

---

## Self-Review

- **Spec coverage:** Sekcje specu → Tasks: §2 logging (T1+T2), §3 metryki (T3), §4 Prometheus/Grafana (T5), §5 coverage gate (T6), §6 CodeQL (T7), §7 SonarCloud (T8), §10 requirements (T9). Podpięcie w app.ts (§1 struktura) = T4. DoD §11: logger (T1/T2), /api/metrics (T3/T4), prometheus+grafana (T5), Grafana pokazuje wykresy (T5 Step 7), coverage gate (T6), CodeQL (T7), SonarCloud (T8), requirements (T9). ✅
- **Placeholder scan:** Brak „TODO/handle errors". `<org>`/`<owner>` w Task 8 to jawnie oznaczone wartości do uzupełnienia (wymóg manualny), nie placeholder logiki. ✅
- **Type consistency:** `resolveLevel` (T1) → użyte w `logger.ts`. `requestLogger` (T2), `metricsMiddleware`/`metricsRouter`/`registry`/`httpDuration` (T3) → identyczne nazwy w T4 app.ts. Metryka `http_request_duration_seconds` spójna: definicja (T3), test (T3/T4), dashboard PromQL (T5), Global Constraints. ✅
- **Świadome nakładanie:** CodeQL (bezpieczeństwo) i SonarCloud (utrzymywalność) celowo oba — odnotowane w spec i decyzjach 42/43.
