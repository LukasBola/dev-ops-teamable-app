# Etap 4 — Konteneryzacja (Docker) — projekt techniczny

> **Data:** 2026-06-11
> **Status:** zaakceptowany (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md) (Etap 4 w sekcji 2.3)
> **Poprzedni etap:** [spec Etapu 3](2026-06-11-etap3-mongodb-design.md) · [plan Etapu 3](../plans/2026-06-11-etap3-mongodb.md)
> **Charakter:** projekt edukacyjny — aplikacja jest poligonem do nauki DevOps. Kod aplikacji minimalny; nacisk na proces: **multi-stage builds**, **docker-compose prod-like**, **GHCR**, **healthchecks**.

## Cel etapu

Spakować frontend i backend w lekkie obrazy Docker i połączyć je z Mongo w jeden prod-like stack (`docker compose up`). Zautomatyzować budowanie i publikację obrazów w CI (GitHub Container Registry). Kod aplikacji, kontrakt API i strategia testów **bez zmian** — zmienia się wyłącznie sposób pakowania i uruchamiania aplikacji.

Cały ciężar edukacyjny jest po stronie DevOps, zgodnie z wierszem Etapu 4 w `requirements.md` (2.3): _„Obrazy, docker-compose, środowiska lokalne = prod-like"_.

**Poza zakresem tej rundy:** wdrożenia na środowiska (dev/staging/prod), promocja artefaktów między środowiskami, sekrety (Vault / GitHub Secrets per środowisko), Kubernetes, CDN dla statycznych zasobów frontendu.

## Decyzje projektowe (z brainstormingu)

| Temat | Decyzja | Uzasadnienie |
|-------|---------|--------------|
| Zakres `docker compose up` | **Pełny stack**: mongo + backend + frontend-nginx | Jedno polecenie = kompletna aplikacja, identyczna ze środowiskiem prod |
| Budowa obrazów | **Multi-stage builds** (builder → runtime) dla obu serwisów | Lekkie obrazy produkcyjne; `node_modules` devDependencies i pliki źródłowe nie trafiają do runtime |
| Serwowanie frontendu | **nginx:alpine** — pliki statyczne + **proxy_pass `/api/` → backend** | Jeden port dla całej aplikacji; frontend nie zna adresu backendu w runtime |
| Rejestr obrazów | **GitHub Container Registry (GHCR)** — push na `main` | `GITHUB_TOKEN` działa out-of-the-box; naturalny most pod Etap 5 (deploy = pull obrazu po SHA) |
| Tagowanie | **SHA commita** + `latest` (tylko `main`) | SHA = niezmienny identyfikator do promocji przez środowiska w Etapie 5 |
| Non-root w kontenerze | **`USER app`** w obu Dockerfile'ach | Jeden wiersz; brak powodu, by odkładać na później |
| Healthcheck | Backend: `/api/health` (gotowe z Etapu 3); Mongo: `mongosh ping` | `depends_on: service_healthy` — deterministyczna kolejność startu |
| Wolumeny | `teamable-mongo-data` (dane Mongo) + `teamable-uploads` (avatary) | Przeżywają `docker compose down`; giną dopiero przy `-v` |
| Migracje w compose | Wykonywane w bootstrapie backendu (`index.ts`: connect → migrate → listen) | Zero osobnych init containerów; ta sama ścieżka co dev i CI |
| E2E | **Bez zmian** — Testcontainers jak w Etapie 3 | docker-compose to narzędzie dev, nie zmienia strategii testowej; smoke-testy na realnym środowisku — Etap 5 |
| CI — kiedy push | **Tylko na `main`**; na PR tylko `docker build` (weryfikacja) | Nie zaśmiecamy rejestru każdą gałęzią; broken image nigdy nie trafia do GHCR |

## 1. Architektura i struktura repo

Zmiana jest w warstwie operacyjnej — kod aplikacji, kontrakt API i testy bez zmian.

```text
teamable/
  backend/
    Dockerfile                    # NOWY: multi-stage (builder → runtime)
    docker-entrypoint.sh          # NOWY: migrate:up → node dist/index.js
    .dockerignore                 # NOWY
    docker-compose.yml            # BEZ ZMIAN: mongo-only (dev bez konteneryzacji aplikacji)
    src/                          # BEZ ZMIAN
    migrations/                   # BEZ ZMIAN
    scripts/migrate.cjs           # BEZ ZMIAN
  frontend/
    Dockerfile                    # NOWY: multi-stage (builder → nginx)
    nginx.conf                    # NOWY: statyczne + proxy_pass /api
    .dockerignore                 # NOWY
    src/                          # BEZ ZMIAN
  docker-compose.yml              # NOWY w root: pełny stack (mongo + backend + frontend)
  .github/workflows/ci.yml        # ZMIANA: nowy job `docker`
  requirements.md                 # ZMIANA: 2.4 link, decyzje Etap 4
```

**`backend/docker-compose.yml`** z Etapu 3 (usługa `mongo` + wolumen) pozostaje bez zmian — nadal służy do lokalnego dev bez konteneryzacji aplikacji (`docker compose -f backend/docker-compose.yml up -d`). Root `docker-compose.yml` to nowy, pełny stack.

## 2. Dockerfile — backend

`backend/Dockerfile`:

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

`backend/docker-entrypoint.sh`:

```sh
#!/bin/sh
set -e
node scripts/migrate.cjs up
exec node dist/index.js
```

**Kluczowe decyzje:**

- **Stage `builder`**: instaluje wszystkie zależności (w tym devDependencies) i kompiluje TypeScript → `dist/`.
- **Stage `runtime`**: zaczyna od czystego obrazu, instaluje tylko `--omit=dev` (produkcyjne zależności), kopiuje `dist/` z buildera. Obraz nie zawiera kodu źródłowego TypeScript ani devDependencies.
- **`docker-entrypoint.sh`**: shell skrypt (`node scripts/migrate.cjs up && exec node dist/index.js`) — uruchamiany jako `ENTRYPOINT`. Migracje wykonują się przed każdym startem serwera, idempotentnie. `index.ts` z Etapu 3 pozostaje bez zmian (nadal tylko `connectDb()` → `listen()`). `exec` zastępuje proces shella procesem Node.js — sygnały (`SIGTERM`, `SIGINT`) trafiają bezpośrednio do aplikacji.
- **`data/uploads`** tworzony w obrazie z właścicielem `app`. W runtime wolumen `teamable-uploads` montowany w tym miejscu nadpisuje zawartość — pliki avatarów przeżywają restart kontenera.
- **Healthcheck** uderza w `/api/health` — zwraca 200 tylko przy aktywnym połączeniu z Mongo (gotowe z Etapu 3). Używane przez `depends_on: service_healthy` w compose.

`backend/.dockerignore`:

```
node_modules
dist
.git
*.md
.env*
coverage
data
```

## 3. Dockerfile — frontend + nginx

`frontend/Dockerfile`:

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

`frontend/nginx.conf`:

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

**Kluczowe decyzje:**

- **Stage `builder`**: `npm ci` + `npm run build` → `dist/`.
- **Stage `runtime`**: nginx:alpine, tylko `dist/`. Obraz nie zawiera Node.js ani kodu źródłowego.
- **`proxy_pass http://backend:3000`**: DNS `backend` rozwiązywany przez sieć Docker compose. Frontend nie zna zewnętrznego adresu backendu — konfiguracja runtime-neutral.
- **`try_files $uri $uri/ /index.html`**: SPA routing — Vue Router w trybie `history` nie dostaje 404 przy bezpośrednim URL.
- **`VITE_API_BASE_URL`**: pusty (lub brak) przy budowaniu obrazu. Frontend wysyła żądania na ten sam origin (`/api/...`); nginx przekazuje je do backendu. Żadnych zmian kodu frontendu — kontrakt z Etapu 2 niezmieniony.

`frontend/.dockerignore`:

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

## 4. docker-compose.yml (root) — pełny stack

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

**Kluczowe decyzje:**

- **Tylko frontend eksponuje port** (`8080:80`). Backend (`3000`) i Mongo (`27017`) dostępne wyłącznie w sieci compose. Dostęp do backendu — przez nginx.
- **`depends_on: condition: service_healthy`**: compose czeka na `mongosh ping` zanim backend startuje, i na `/api/health` zanim nginx startuje. Deterministyczna kolejność — brak wyścigów przy `docker compose up`.
- **`MONGODB_URI` jako env var** w compose — nie w obrazie, nie w repo. W Etapie 5 zastąpione przez GitHub Secrets / inne zarządzanie sekretami per środowisko.
- **`teamable-uploads`** — wolumen na avatary. Dane przeżywają `docker compose down`; czyszczone przez `docker compose down -v`.
- **Migracje**: `ENTRYPOINT` kontenera backendu uruchamia `docker-entrypoint.sh` → `node scripts/migrate.cjs up` → `exec node dist/index.js`. Idempotentne — wielokrotny restart kontenera bezpieczny.

**Polecenia dev:**

```bash
# Pełny stack prod-like (pierwszy raz lub po zmianach kodu):
docker compose up --build

# Pełny stack z istniejącymi obrazami:
docker compose up

# Tylko Mongo (dev z hot-reload):
docker compose -f backend/docker-compose.yml up -d

# Zatrzymanie + usunięcie wolumenów:
docker compose down -v
```

## 5. Migracje w compose

Backend kontener używa `ENTRYPOINT ["./docker-entrypoint.sh"]`:

```sh
#!/bin/sh
set -e
node scripts/migrate.cjs up
exec node dist/index.js
```

Migracje wykonują się przed każdym startem serwera. Ponieważ są idempotentne (changelog w bazie śledzi zastosowane migracje), wielokrotny restart kontenera jest bezpieczny. `index.ts` z Etapu 3 pozostaje bez zmian — nie musi wiedzieć o migracjach. `exec` zapewnia że sygnały (`SIGTERM`/`SIGINT`) trafiają do procesu Node.js, a nie do powłoki — graceful shutdown działa poprawnie.

Żadnego osobnego init container ani `docker compose run` — ta sama ścieżka co w dev (`npm run migrate:up`) i w CI (Vitest globalSetup).

## 6. CI — job `docker`

Nowy job dochodzi po `frontend`, `backend`, `e2e`. Na PR — tylko `docker build` (weryfikacja). Na `main` — build + push do GHCR.

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

**Kluczowe decyzje:**

- **`needs: [frontend, backend, e2e]`** — obrazy budowane dopiero po zielonych testach. Nigdy nie pushujemy złamanego obrazu do GHCR.
- **`GITHUB_TOKEN`** — zero konfiguracji sekretów repozytoryjnych; działa out-of-the-box dla GHCR.
- **Tagowanie:** `sha` (np. `a3f1b2c`) jako niezmienny identyfikator per commit + `latest` na `main`. W Etapie 5 tag SHA staje się identyfikatorem artefaktu do promowania przez środowiska.
- **`push: ${{ github.ref == 'refs/heads/main' }}`** — na PR CI tylko weryfikuje że `docker build` przechodzi; push do rejestru wyłącznie na `main`.
- **OCI labels** generowane przez `docker/metadata-action` (źródło, SHA, URL repo) — standard obrazów produkcyjnych.

## 7. Strategia testów

Bez zmian względem Etapu 3:

- **Backend unit i integracyjne (Testcontainers)** — niezmienione.
- **Frontend unit** — niezmienione.
- **E2E (Playwright + Testcontainers)** — niezmieniony orchestrator (`scripts/e2e-mongo.ts`), Testcontainers podnosi `mongod`, Playwright testuje na `localhost:4173`. `docker-compose.yml` to narzędzie dev, nie zmienia strategii testowej.

**Weryfikacja obrazów w CI:** `docker build` na każdym PR — jeśli Dockerfile jest błędny, job `docker` czerwienieje przed mergem. To jest cały nowy zakres testowania w Etapie 4.

**Smoke testy na compose stacku** (np. `docker compose up` + `curl localhost:8080`) — świadomie odłożone do Etapu 5, gdzie będą pierwszą weryfikacją wdrożonego środowiska.

## 8. Nacisk DevOps Etapu 4 → projekt

| Nacisk DevOps | Gdzie w tym projekcie |
|---|---|
| **Obrazy Docker** | Sekcje 2–3: multi-stage Dockerfile dla backend (node) i frontend (nginx), non-root users, `.dockerignore` |
| **docker-compose prod-like** | Sekcja 4: root `docker-compose.yml`, `depends_on: service_healthy`, wolumeny, pojedynczy port wejściowy |
| **Środowiska lokalne = prod-like** | `docker compose up --build` = kompletna aplikacja na `localhost:8080`; ta sama ścieżka startu co na serwerze |
| **Rejestr obrazów** | Sekcja 5: GHCR, tag SHA + latest, push tylko po zielonych testach i tylko na `main` |

## 9. Zmiany w `requirements.md`

- **Sekcja 2.4** — dodać wiersz z linkiem do tego specu (plan `_(w przygotowaniu)_`).
- **Sekcja 8.1** — dodać blok **„Decyzje — Etap 4"** (tabela decyzji z tego specu).

## 10. Definicja ukończenia — Etap 4

- [ ] `backend/Dockerfile` multi-stage (builder → runtime), non-root `app`, HEALTHCHECK `/api/health`, `migrations/` i `scripts/migrate.cjs` w obrazie; `docker-entrypoint.sh` jako ENTRYPOINT (`migrate:up` → `exec node`); `backend/.dockerignore`
- [ ] `frontend/Dockerfile` multi-stage (builder → nginx:alpine), `nginx.conf` z `proxy_pass /api/ → backend:3000` i `try_files` dla SPA; `frontend/.dockerignore`
- [ ] Root `docker-compose.yml`: mongo + backend + frontend, `depends_on: service_healthy`, wolumeny `teamable-mongo-data` + `teamable-uploads`, tylko port `8080` na zewnątrz
- [ ] `backend/docker-compose.yml` z Etapu 3 bez zmian — nadal działa dev bez konteneryzacji aplikacji
- [ ] `docker compose up --build` uruchamia kompletną aplikację na `localhost:8080`; migracje wykonują się przy starcie backendu; avatary utrwalone w wolumenie
- [ ] CI: job `docker` (po zielonych `frontend` + `backend` + `e2e`); na PR tylko `docker build`, na `main` build + push do GHCR z tagiem SHA i `latest`; `permissions: packages: write`
- [ ] `requirements.md` zaktualizowane (2.4 link, decyzje Etap 4)

## 11. Poza zakresem (świadomie odłożone)

- Wdrożenia na środowiska (dev/staging/prod), promocja obrazów po SHA między środowiskami — Etap 5.
- Sekrety per środowisko (GitHub Secrets / Vault / Docker Secrets) — Etap 5.
- Smoke testy na compose stacku w CI — Etap 5.
- Kubernetes, Helm, CDN, multi-arch builds (`linux/arm64`).
- MongoDB z uwierzytelnianiem (`MONGO_INITDB_ROOT_USERNAME` itp.) — overengineering bez realnego środowiska docelowego.
- Buildx cache (`cache-from`/`cache-to` w CI) — warto dodać, ale nie blokuje celu edukacyjnego Etapu 4.
