# ADR-0014: Node.js 24 LTS jako runtime w CI, obrazach Docker i typach

- **Status:** Proponowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-24 (źródło: analiza pierwszych PR-ów Dependabota, #15 i #18)
- **Data spisania:** 2026-11-24
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

CI (`node-version: 20` w `ci.yml`) i obrazy (`node:20-alpine`) działały na Node 20. Ostatnie wydanie tej linii to v20.20.2 z 2026-03-24. Według harmonogramu Node.js wsparcie skończyło się 30.04.2026 [wniosek: harmonogramu nie pobrano w tej sesji].

Pierwszy przebieg Dependabota pokazał, że zależności porzucają Node 20:
- `testcontainers` 12.2.1 ciągnie `undici` 8.12.4 (`engines.node: >=22.19.0`), przez co testy backendu padają na Node 20 (#15);
- `vitest` 5.1.0 wymaga `^22.12.0 || ^24.0.0 || >=26.0.0` (#18, #21).

Kompilacja już celowała w Node 24 (`@tsconfig/node24`), a lokalnie używany jest Node 24.

## Decyzja

Node.js 24 LTS jest runtime'em wszędzie:
- `node-version: 24` w `ci.yml`;
- `node:24-alpine` w obu Dockerfile;
- `engines.node: ">=24"` w backendzie i frontendzie;
- `@types/node` w wersji major 24.

Major `@types/node` podbijamy razem z runtime'em, dlatego Dependabot go pomija (`ignore` w `.github/dependabot.yml`, PR #23).

## Rozważane opcje

- **Node 26 LTS:** najdłuższe wsparcie, a do tego od razu zgodny z `@types/node` 26 (#17, #19). Odrzucony na teraz: jest LTS dopiero od miesiąca, więc większe ryzyko, że któraś zależność go jeszcze nie wspiera [wniosek]. Kandydat na następną aktualizację.
- **Node 22 LTS:** spełnia wymagania `undici` i `vitest`, ale jest już w fazie utrzymania i kończy się wcześniej (04.2027 [wniosek]). Oznacza szybszą kolejną migrację.
- **Pozostanie na Node 20:** odrzucone, bo linia nie dostaje poprawek bezpieczeństwa i blokuje aktualizacje zależności.

## Konsekwencje

**Pozytywne**

- Runtime z poprawkami bezpieczeństwa.
- Odblokowane aktualizacje z #15 i `vitest` 5.
- `tsconfig`, typy i runtime opisują tę samą wersję Node.

**Negatywne / koszty**

- Lokalnie potrzebny Node 24+. `engines` tylko ostrzega, bo npm domyślnie nie blokuje instalacji (`engine-strict=false`) [wniosek].
- Kolejna migracja (na Node 26) przed końcem wsparcia Node 24 (04.2028 [wniosek]).

**Niewiadome**

- Zgodność zależności z Node 24 jest potwierdzona testami (CI, e2e), a nie deklaracjami autorów paczek.

## Dowody

- `nodejs.org/dist/index.json` (2026-11-24): v24.22.3 `lts=Krypton`, v26.13.1 `lts=Lithium`, v22.23.5 `lts=Jod`. Ostatnie wydanie linii 20: v20.20.2, 2026-03-24.
- `npm view undici@8.12.4 engines` → `node >=22.19.0`. `npm view vitest@5.1.0 engines` → `^22.12.0 || ^24.0.0 || >=26.0.0`.
- CI run 45486953644 (PR #15, Node 20): `TypeError: Cannot read properties of undefined (reading 'bind')` w `undici/lib/interceptor/decompress.js:78` (`createZstdDecompress`).
- `backend/tsconfig.json`, `frontend/tsconfig.node.json`: `extends: @tsconfig/node24`.
- Weryfikacja przed PR-em (kopia gałęzi, Node 24.8):
  - frontend i backend: lint, prettier, `type-check`, testy z coverage (backend 115/115), build — OK;
  - `docker build` obu obrazów na `node:24-alpine` OK, w obrazie działa v24.22.3;
  - e2e 73/74. `SEC-3` pada tak samo na Node 20 i tylko lokalnie na macOS, w CI przechodzi.
