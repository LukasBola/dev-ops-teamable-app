# Etap 6 — Obserwowalność i jakość — projekt techniczny

> **Data:** 2026-06-17
> **Status:** zaakceptowany (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md) (Etap 6 w sekcji 2.3)
> **Poprzedni etap:** [spec Etapu 5](2026-06-17-etap5-wdrozenia-design.md)
> **Charakter:** projekt edukacyjny — aplikacja jest poligonem do nauki DevOps. Kod aplikacji minimalny; nacisk na proces: **structured logging**, **metryki (Prometheus + Grafana)**, **coverage gate**, **analiza statyczna (CodeQL + SonarCloud)**.

## Cel etapu

Dodać do aplikacji warstwę obserwowalności (logi + metryki + dashboardy) oraz domknąć bramy jakości w CI (pokrycie kodu jako twardy gate + dwie niezależne analizy statyczne). Funkcjonalność aplikacji **bez zmian** — dochodzi instrumentacja i automatyzacja jakości.

Cały ciężar edukacyjny jest po stronie DevOps, zgodnie z wierszem Etapu 6 w `requirements.md` (2.3): _„Logi, metryki, coverage gates, ewentualnie analiza statyczna"_.

> **Uwaga (model ephemeral z Etapu 5):** Prometheus i Grafana żyją w stacku compose (lokalny dev oraz podniesione środowisko w smoke teście CD), nie na trwałej „produkcji" — bo prod też jest ephemeral. Celem jest zobaczyć pełny łańcuch instrumentacja → scrape → dashboard w działaniu, nie utrzymywać stały monitoring.

**Poza zakresem tej rundy:** trwały, długoterminowy storage metryk; alerting (Alertmanager, PagerDuty); distributed tracing (OpenTelemetry/Jaeger); centralna agregacja logów (Loki/ELK); SLO/error budgets.

## Decyzje projektowe (z brainstormingu)

| # | Temat | Decyzja | Uzasadnienie |
|---|-------|---------|--------------|
| 38 | Logowanie | **pino** — structured JSON logging z `requestId` (middleware) | Standard w ekosystemie Node; JSON gotowy pod maszynowe przetwarzanie; `LOG_LEVEL` sterowany per środowisko (Etap 5) |
| 39 | Metryki | **prom-client** — endpoint `GET /api/metrics` (format Prometheus) | Liczniki HTTP, histogram latencji, default Node metrics; natywny format scrape |
| 40 | Stack monitoringu | **Prometheus + Grafana** jako usługi w compose | Pełny, „prawdziwy" łańcuch scrape → dashboard; zobaczyć jak to działa end-to-end |
| 41 | Coverage gate | **Vitest coverage** z progiem łamiącym CI (start ~70%, frontend + backend) | Realizacja „próg wprowadzimy stopniowo" z sekcji 6 requirements |
| 42 | Analiza statyczna #1 | **CodeQL** (GitHub native) | Darmowe, zero infry, wynik w zakładce Security; naturalne dla GitHub Actions |
| 43 | Analiza statyczna #2 | **SonarCloud** | Bogatsze metryki jakości (code smells, duplikacja, quality gate) obok bezpieczeństwa z CodeQL |

## 1. Architektura i struktura repo

Zmiana dotyka backendu (instrumentacja), compose (monitoring) i CI (bramy jakości). Frontend i kontrakt API bez zmian.

```text
teamable/
  backend/
    src/
      logger.ts                   # NOWY: pino, konfiguracja LOG_LEVEL
      middleware/
        requestLogger.ts          # NOWY: requestId + log per żądanie
        metrics.ts                # NOWY: prom-client, histogram/liczniki
      routes/
        metrics.ts                # NOWY: GET /api/metrics
      index.ts                    # ZMIANA: podpięcie loggera, metryk, /api/metrics
  monitoring/
    prometheus.yml                # NOWY: scrape config backend:/api/metrics
    grafana/
      dashboards/teamable.json    # NOWY: dashboard (RPS, latencja, błędy)
      provisioning/...            # NOWY: datasource + dashboard provisioning
  docker-compose.yml              # ZMIANA: + usługi prometheus + grafana
  .github/workflows/
    ci.yml                        # ZMIANA: coverage gate w jobach test
    codeql.yml                    # NOWY: analiza CodeQL
    sonarcloud.yml                # NOWY (lub job): analiza SonarCloud
  sonar-project.properties        # NOWY: konfiguracja SonarCloud
  requirements.md                 # ZMIANA: 2.4 link, decyzje Etap 6
```

## 2. Structured logging (pino)

`backend/src/logger.ts`:

```ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  formatters: { level: (label) => ({ level: label }) },
});
```

`backend/src/middleware/requestLogger.ts` — middleware nadające `requestId` (np. `crypto.randomUUID()`), logujące start/koniec żądania z metodą, ścieżką, statusem i czasem.

**Kluczowe decyzje:**

- **JSON logging** — gotowe pod maszynowe przetwarzanie/agregację (przyszłe Loki/ELK poza zakresem).
- **`LOG_LEVEL` z env** — `debug` na dev, `info`/`warn` wyżej (spina się z decyzją 35 Etapu 5).
- **`requestId`** — korelacja logów jednego żądania; fundament pod późniejsze tracing.

## 3. Metryki (prom-client)

`backend/src/middleware/metrics.ts`:

```ts
import client from "prom-client";

client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Czas obsługi żądania HTTP",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.3, 1, 3],
});

export const registry = client.register;
```

`backend/src/routes/metrics.ts` — `GET /api/metrics` zwraca `registry.metrics()` z `Content-Type: text/plain; version=0.0.4`.

**Kluczowe decyzje:**

- **`collectDefaultMetrics`** — CPU, pamięć, event loop lag (default Node metrics) za darmo.
- **Histogram latencji** z etykietami `method`/`route`/`status` — RPS, p95, error rate liczalne w Prometheus.
- **`/api/metrics`** pod tym samym prefiksem `/api` — przechodzi przez nginx proxy z Etapu 4 bez nowej reguły.

## 4. Prometheus + Grafana w compose

`monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 10s
scrape_configs:
  - job_name: teamable-backend
    metrics_path: /api/metrics
    static_configs:
      - targets: ["backend:3000"]
```

Dodatek do `docker-compose.yml`:

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

**Kluczowe decyzje:**

- **Prometheus scrape `backend:3000/api/metrics`** przez sieć compose — DNS `backend` jak w Etapie 4.
- **Grafana z provisioningiem** — datasource (Prometheus) i dashboard ładowane z plików, zero ręcznej konfiguracji po starcie. `docker compose up` → dashboard od razu działa.
- **Anonymous admin** — projekt edukacyjny lokalny; bez logowania, by od razu zobaczyć wykresy.
- **Porty 9090/3001** wystawione lokalnie do podglądu; w środowisku ephemeral CD opcjonalne.

## 5. Coverage gate

W `vitest.config.ts` (frontend i backend):

```ts
test: {
  coverage: {
    provider: "v8",
    reporter: ["text", "lcov"],
    thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
  },
}
```

**Kluczowe decyzje:**

- **Próg łamie build** — spadek pokrycia poniżej 70% czerwieni job (Vitest exit ≠ 0). Start 70%, podnoszony stopniowo (zgodnie z sekcją 6 requirements: „próg wprowadzimy stopniowo").
- **`lcov`** — raport konsumowany przez SonarCloud (sekcja 7) i ewentualny badge.
- Osobne progi per pakiet (frontend/backend) — różne dojrzałości testów.

## 6. CodeQL

`.github/workflows/codeql.yml`:

```yaml
name: codeql
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
  schedule: [{ cron: "0 6 * * 1" }]   # cotygodniowy pełny skan

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with: { languages: javascript-typescript }
      - uses: github/codeql-action/analyze@v3
```

**Kluczowe decyzje:**

- **Native GitHub, zero infry** — wyniki w zakładce Security / jako annotacje w PR.
- **JS/TS jeden język** pokrywa frontend i backend.
- **Schedule** — cotygodniowy pełny skan łapie podatności w niezmienionym kodzie.

## 7. SonarCloud

`sonar-project.properties`:

```properties
sonar.organization=<org>
sonar.projectKey=<owner>_teamable
sonar.sources=frontend/src,backend/src
sonar.tests=frontend/src,backend/src
sonar.test.inclusions=**/*.spec.ts,**/*.test.ts
sonar.javascript.lcov.reportPaths=frontend/coverage/lcov.info,backend/coverage/lcov.info
```

Job (`sonarcloud.yml` lub krok w `ci.yml`) uruchamiany **po** testach z coverage:

```yaml
sonarcloud:
  needs: [frontend, backend]      # potrzebuje lcov z coverage
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
      with: { fetch-depth: 0 }     # pełna historia dla blame/new-code
    - uses: SonarSource/sonarqube-scan-action@v4
      env:
        SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

**Kluczowe decyzje:**

- **Konsumuje lcov** z coverage gate (sekcja 5) — jedno źródło pokrycia dla obu narzędzi.
- **Quality gate** SonarCloud (code smells, duplikacja, coverage on new code) jako dodatkowa brama na PR.
- **`SONAR_TOKEN`** w GitHub Secrets — jedyny wymagany sekret zewnętrzny tego etapu.
- **Świadome nakładanie się z CodeQL** — CodeQL skupia się na bezpieczeństwie, SonarCloud na utrzymywalności; oba zostawione, by zobaczyć różnicę w praktyce.

## 8. Strategia testów

Strategia testów funkcjonalnych bez zmian (unit / integracyjne Testcontainers / E2E / smoke). Etap 6 dokłada **bramy jakości wokół** tych testów (coverage threshold) oraz **analizy statyczne** (CodeQL, SonarCloud) — nie nowe testy logiki, lecz automatyczną ocenę jakości kodu i pokrycia.

Lekki test instrumentacji: `GET /api/metrics` zwraca 200 i zawiera `http_request_duration_seconds` (potwierdza, że metryki są eksponowane).

## 9. Nacisk DevOps Etapu 6 → projekt

| Nacisk DevOps | Gdzie w tym projekcie |
|---|---|
| **Logi** | Sekcja 2: pino, structured JSON, `requestId`, `LOG_LEVEL` per środowisko |
| **Metryki** | Sekcje 3–4: prom-client `/api/metrics`, Prometheus scrape, Grafana dashboard |
| **Coverage gates** | Sekcja 5: progi Vitest łamiące build, lcov |
| **Analiza statyczna** | Sekcje 6–7: CodeQL (bezpieczeństwo) + SonarCloud (utrzymywalność, quality gate) |

## 10. Zmiany w `requirements.md`

- **Sekcja 2.4** — dodać wiersz z linkiem do tego specu (plan `_(w przygotowaniu)_`).
- **Sekcja 6** — odnotować wprowadzenie twardego progu coverage (gate).
- **Sekcja 8.1** — dodać blok **„Decyzje — Etap 6"** (tabela decyzji 38–43 z tego specu).

## 11. Definicja ukończenia — Etap 6

- [ ] Backend: pino logger (`LOG_LEVEL` z env), middleware z `requestId` i logiem per żądanie
- [ ] Backend: prom-client + `GET /api/metrics` (default metrics + histogram latencji HTTP)
- [ ] `monitoring/prometheus.yml` scrape backendu; usługi `prometheus` + `grafana` w compose z provisioningiem datasource i dashboardu
- [ ] `docker compose up` → Grafana na `localhost:3001` pokazuje RPS/latencję/błędy z działającej aplikacji
- [ ] Coverage gate (≥70% start) w Vitest dla frontend i backend; spadek łamie CI; raport lcov
- [ ] CodeQL workflow (push/PR/schedule) — wyniki w zakładce Security
- [ ] SonarCloud skan z quality gate; konsumuje lcov; `SONAR_TOKEN` w Secrets
- [ ] `requirements.md` zaktualizowane (2.4 link, sekcja 6, decyzje Etap 6)

## 12. Poza zakresem (świadomie odłożone)

- Alerting (Alertmanager, powiadomienia) i SLO/error budgets.
- Distributed tracing (OpenTelemetry, Jaeger).
- Centralna agregacja logów (Loki, ELK, Datadog).
- Trwały, długoterminowy storage metryk (Thanos, remote write).
- Monitoring frontendu (RUM, web vitals w produkcji).
