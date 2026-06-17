# Etap 5 — Wdrożenia na środowiska (dev/staging/prod) — projekt techniczny

> **Data:** 2026-06-17
> **Status:** zaakceptowany (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md) (Etap 5 w sekcji 2.3)
> **Poprzedni etap:** [spec Etapu 4](2026-06-11-etap4-docker-design.md) · [plan Etapu 4](../plans/2026-06-11-etap4-docker.md)
> **Charakter:** projekt edukacyjny — aplikacja jest poligonem do nauki DevOps. Kod aplikacji bez zmian; nacisk na proces: **CD**, **promocja artefaktu po SHA (build once, deploy many)**, **GitHub Environments + sekrety per środowisko**, **release flow**, **smoke testy**.

## Cel etapu

Zbudować pełny przepływ Continuous Delivery: ten sam obraz Docker z GHCR (zbudowany w Etapie 4, identyfikowany po SHA commita) jest **promowany przez trzy środowiska** — dev → staging → production — z konfiguracją i sekretami per środowisko oraz smoke testem po każdym wdrożeniu. Kod aplikacji, kontrakt API i strategia testów jednostkowych/integracyjnych/E2E **bez zmian** — dochodzi wyłącznie warstwa wdrożeniowa.

Cały ciężar edukacyjny jest po stronie DevOps, zgodnie z wierszem Etapu 5 w `requirements.md` (2.3): _„CD, promocja artefaktów, sekrety, zmienne środowiskowe"_.

### Model środowisk: ephemeral w CI

Projekt nie ma realnego serwera docelowego (decyzja z brainstormingu). „Wdrożenie" jest **symulowane wewnątrz GitHub Actions**:

1. Job pobiera obraz z GHCR po konkretnym SHA (`docker compose pull`).
2. Podnosi pełny stack (`docker compose up -d`) z konfiguracją danego środowiska.
3. Uruchamia **smoke test** (`/api/health` + `curl` frontendu).
4. Robi teardown (`docker compose down -v`).

Nic nie „żyje" poza pipeline'em. To świadoma decyzja: uczymy się **mechaniki CD, promocji, gates i sekretów** bez kosztów i konfiguracji zewnętrznej infrastruktury. Przejście na realny host (VPS/PaaS) w przyszłości wymaga tylko podmiany kroku „compose up w jobie" na „ssh + compose up na hoście" — reszta przepływu (promocja po SHA, Environments, smoke) zostaje.

**Poza zakresem tej rundy:** realny hosting (VPS/Kubernetes/PaaS), trwałe środowiska między pipeline'ami, blue-green/canary, rollback automatyczny, CDN, zarządzanie sekretami poza GitHub Environments (Vault/SOPS).

## Decyzje projektowe (z brainstormingu)

| # | Temat | Decyzja | Uzasadnienie |
|---|-------|---------|--------------|
| 30 | Cel wdrożenia | **Ephemeral w CI**: `compose pull` → `up` → smoke test → `down` | Zero kosztów i kont; pełna nauka promocji, gates i sekretów; łatwa przyszła migracja na realny host |
| 31 | Trigger CD | `main` → deploy **dev + staging** (auto); tag `v*` / GitHub Release → deploy **prod** | Uczy release flow i wersjonowania artefaktu; prod nigdy nie wdraża się „przypadkiem" z merge'a |
| 32 | Promowany artefakt | **Ten sam obraz GHCR po SHA** (build once, deploy many) | Niezmienny artefakt przez wszystkie środowiska; release tylko mapuje wersję → SHA, nie buduje od nowa |
| 33 | Sekrety i zmienne | **GitHub Environments** (`dev`/`staging`/`production`) z własnymi secrets/variables + protection rules | Natywne dla GitHub Actions; approval gate i required reviewers na `production` |
| 34 | Dane per środowisko | dev/staging: idempotentny `npm run seed` (Etap 3); prod: **czysty start** (FR-9) | Pokazuje różnicę danych między środowiskami bez zmiany obrazu |
| 35 | Flagi runtime | `LOG_LEVEL` per środowisko (debug na dev, info/warn wyżej), seed on/off | Konfiguracja zależna od środowiska sterowana wyłącznie env varami; spina się z Etapem 6 |
| 36 | Izolacja środowisk | Osobne compose project name (`teamable_dev`/`_staging`/`_production`), różne porty w smoke teście | Ilustruje izolację stacków; w modelu ephemeral głównie dydaktyczne |
| 37 | Smoke test | `/api/health` (200 + Mongo OK) + `curl` frontendu na podniesionym stacku | Realizacja smoke testu świadomie odłożonego z Etapu 4 (decyzja 29) |

## 1. Architektura i struktura repo

Zmiana jest wyłącznie w warstwie wdrożeniowej — kod aplikacji, kontrakt API i testy bez zmian.

```text
teamable/
  docker-compose.yml              # BEZ ZMIAN: pełny stack z build (dev lokalny, Etap 4)
  docker-compose.deploy.yml       # NOWY: stack z image (GHCR po SHA), bez build
  .github/workflows/
    ci.yml                        # BEZ ZMIAN (lub drobny refactor wspólnych kroków)
    cd.yml                        # NOWY: deploy dev+staging (main) i prod (tag v*)
  scripts/
    smoke-test.sh                 # NOWY: health + curl po deployu
  .env.example                    # ZMIANA: dokumentuje zmienne per środowisko
  requirements.md                 # ZMIANA: 2.4 link, decyzje Etap 5
```

`docker-compose.yml` z Etapu 4 (z `build:`) zostaje narzędziem lokalnego dev. Nowy `docker-compose.deploy.yml` używa `image:` z GHCR — to ten obraz jest promowany.

## 2. Compose wdrożeniowy — obraz zamiast build

`docker-compose.deploy.yml`:

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

**Kluczowe decyzje:**

- **`image:` zamiast `build:`** — wdrożenie nigdy nie buduje; pobiera dokładnie ten obraz, który przeszedł testy w Etapie 4. `IMAGE_TAG` = SHA commita (lub `latest` dla prod po zmapowaniu z taga).
- **`IMAGE_OWNER` / `IMAGE_TAG`** wstrzykiwane z kontekstu Actions — nigdy w repo.
- **`LOG_LEVEL` / `SEED_ON_START`** różnią środowiska bez zmiany obrazu (decyzje 34–35).
- **`FRONTEND_PORT`** różny per środowisko (`teamable_dev`:8081, `staging`:8082, `production`:8083) — izolacja stacków (decyzja 36).

## 3. GitHub Environments — sekrety i bramy

Trzy środowiska konfigurowane w Settings → Environments:

| Environment | Variables | Secrets (przykł.) | Protection |
|---|---|---|---|
| `dev` | `LOG_LEVEL=debug`, `SEED_ON_START=true`, `FRONTEND_PORT=8081` | `MONGODB_URI` (jeśli realny) | brak — auto na `main` |
| `staging` | `LOG_LEVEL=info`, `SEED_ON_START=true`, `FRONTEND_PORT=8082` | `MONGODB_URI` | brak lub opcjonalny reviewer |
| `production` | `LOG_LEVEL=warn`, `SEED_ON_START=false`, `FRONTEND_PORT=8083` | `MONGODB_URI` | **required reviewers** (manual approval) |

**Kluczowe decyzje:**

- **Sekret nigdy w repo** — wartości żyją w GitHub Environments; job odwołuje się przez `environment:` i `${{ secrets.* }}` / `${{ vars.* }}`.
- **Approval gate na `production`** — required reviewers wstrzymuje job prod do ręcznego zatwierdzenia. To jądro nauki kontrolowanej promocji.
- W modelu ephemeral Mongo jest w stacku, więc `MONGODB_URI` może być stałe; sekret pokazuje **wzorzec** zarządzania, gotowy pod realny host.

## 4. Workflow CD

`.github/workflows/cd.yml` (szkic):

```yaml
name: cd
on:
  push:
    branches: [main]            # → dev + staging
    tags: ["v*"]                # → production

jobs:
  resolve:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.t.outputs.tag }}
    steps:
      - id: t
        run: echo "tag=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

  deploy-dev:
    if: github.ref == 'refs/heads/main'
    needs: resolve
    environment: dev
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy + smoke (dev)
        env:
          IMAGE_OWNER: ${{ github.repository_owner }}
          IMAGE_TAG: ${{ needs.resolve.outputs.tag }}
          LOG_LEVEL: ${{ vars.LOG_LEVEL }}
          SEED_ON_START: ${{ vars.SEED_ON_START }}
          FRONTEND_PORT: ${{ vars.FRONTEND_PORT }}
        run: |
          docker compose -p teamable_dev -f docker-compose.deploy.yml pull
          docker compose -p teamable_dev -f docker-compose.deploy.yml up -d
          ./scripts/smoke-test.sh "http://localhost:${FRONTEND_PORT}"
          docker compose -p teamable_dev -f docker-compose.deploy.yml down -v

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: [resolve, deploy-dev]
    environment: staging
    runs-on: ubuntu-latest
    steps: # analogicznie, -p teamable_staging, vars/secrets ze środowiska staging

  deploy-prod:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: resolve
    environment: production       # required reviewers → manual approval
    runs-on: ubuntu-latest
    steps: # analogicznie, -p teamable_production
```

**Kluczowe decyzje:**

- **`main` → dev → staging** sekwencyjnie (`needs`); staging rusza tylko po zielonym dev.
- **`tag v*` → production** osobnym triggerem; `environment: production` wymusza approval.
- **`resolve`** liczy tag obrazu (SHA) raz; promocja używa **tej samej wartości** w każdym środowisku — gwarancja „ten sam artefakt".
- **`environment:`** wiąże job z sekretami/zmiennymi i protection rules danego środowiska.

## 5. Smoke test

`scripts/smoke-test.sh`:

```sh
#!/bin/sh
set -e
BASE="${1:-http://localhost:8080}"

echo "Smoke: backend health"
curl -fsS "$BASE/api/health" | grep -q '"status":"ok"'

echo "Smoke: frontend serwuje index"
curl -fsS "$BASE/" | grep -q '<div id="app">'

echo "Smoke OK"
```

**Kluczowe decyzje:**

- **`/api/health`** (gotowy z Etapu 3) potwierdza backend + połączenie z Mongo.
- **`curl /`** potwierdza, że nginx serwuje SPA i proxy działa.
- `set -e` + `curl -fsS` → każdy błąd czerwieni job; broken deploy nie przechodzi do następnego środowiska.
- To realizacja smoke testu świadomie odłożonego w Etapie 4 (decyzja 29).

## 6. Release flow (produkcja)

```bash
# Po zielonym main (dev+staging OK):
git tag v1.0.0
git push origin v1.0.0
# → workflow cd.yml job deploy-prod → manual approval → deploy + smoke
```

- **Tag = jawny, wersjonowany artefakt.** GitHub Release może dołączyć changelog (Conventional Commits z Etapu 1 to ułatwiają).
- Tag mapuje wersję semantyczną → SHA → ten sam obraz GHCR. Zero rebuildu.

## 7. Strategia testów

Bez zmian względem Etapu 4 (unit / integracyjne Testcontainers / E2E Playwright). **Nowy poziom: smoke test po wdrożeniu** — nie zastępuje E2E, tylko potwierdza, że wdrożony artefakt wstaje i odpowiada. To pierwsza weryfikacja „środowiska", nie logiki.

## 8. Nacisk DevOps Etapu 5 → projekt

| Nacisk DevOps | Gdzie w tym projekcie |
|---|---|
| **CD** | Sekcja 4: workflow `cd.yml`, deploy jako część pipeline'u |
| **Promocja artefaktu** | Sekcje 2, 4, 6: ten sam obraz GHCR po SHA przez dev→staging→prod; release mapuje wersję → SHA |
| **Sekrety per środowisko** | Sekcja 3: GitHub Environments, secrets/variables, approval na production |
| **Zmienne środowiskowe** | Sekcje 2–3: `LOG_LEVEL`, `SEED_ON_START`, `FRONTEND_PORT` różnią środowiska bez zmiany obrazu |
| **Smoke testy** | Sekcja 5: health + curl po każdym deployu |

## 9. Zmiany w `requirements.md`

- **Sekcja 2.4** — dodać wiersz z linkiem do tego specu (plan `_(w przygotowaniu)_`).
- **Sekcja 8.1** — dodać blok **„Decyzje — Etap 5"** (tabela decyzji 30–37 z tego specu).

## 10. Definicja ukończenia — Etap 5

- [ ] `docker-compose.deploy.yml` używa `image:` z GHCR (`IMAGE_OWNER`/`IMAGE_TAG`), parametryzowany `LOG_LEVEL`/`SEED_ON_START`/`FRONTEND_PORT`
- [ ] Trzy GitHub Environments (`dev`/`staging`/`production`) z variables/secrets; `production` z required reviewers (approval gate)
- [ ] `.github/workflows/cd.yml`: `main` → deploy dev → staging (sekwencyjnie); tag `v*` → deploy production; ten sam SHA jako tag obrazu we wszystkich środowiskach
- [ ] `scripts/smoke-test.sh` weryfikuje `/api/health` + frontend; błąd czerwieni job
- [ ] Backend honoruje `SEED_ON_START` (dev/staging seed, prod czysty) i `LOG_LEVEL`
- [ ] `requirements.md` zaktualizowane (2.4 link, decyzje Etap 5)

## 11. Poza zakresem (świadomie odłożone)

- Realny hosting (VPS/PaaS/Kubernetes) i trwałe środowiska między pipeline'ami.
- Rollback automatyczny, blue-green, canary.
- Zarządzanie sekretami poza GitHub Environments (Vault, SOPS, Doppler).
- CDN dla statycznych zasobów frontendu.
- Obserwowalność wdrożeń (logi/metryki/dashboardy) — **Etap 6**.
