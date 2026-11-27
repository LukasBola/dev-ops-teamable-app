# Teamable — Wymagania projektu

> **Status dokumentu:** v0.6 (Etap 4.5 — Uwierzytelnianie — wdrożony; Etapy 5 i 6 — specy i plany gotowe, żywy dokument)
> **Ostatnia aktualizacja:** 2026-11-22
> **Charakter projektu:** projekt edukacyjny — aplikacja jest **poligonem do nauki DevOps**, nie celem samym w sobie.

---

## 1. Cel projektu

Głównym celem projektu jest **nauka DevOps** w praktyce na realnym, stopniowo rozbudowywanym przykładzie:

- pełny cykl SDLC (od commita do wdrożenia),
- CI/CD (automatyzacja buildów, testów, deployów),
- wdrożenia na wiele środowisk (np. dev / staging / production),
- testy na różnych poziomach piramidy testów: **jednostkowe**, **integracyjne**, **UI/E2E (Playwright)**.

Aplikacja (profil użytkownika) jest **pretekstem** — ma być na tyle prosta, by nie odwracać uwagi od DevOps, ale na tyle realistyczna, by dało się na niej ćwiczyć cały SDLC. Decyzje produktowe podejmujemy zawsze pod kątem: *czy to pomaga uczyć się DevOps?*

### 1.1 Zasady przewodnie (guiding principles)

- **Prostota aplikacji, dojrzałość procesu.** Kod aplikacji minimalny; pipeline, testy i automatyzacja — porządne.
- **Rozszerzalność.** Każdy etap będzie rozbudowywany. Struktura repozytorium, kodu i pipeline'u ma to ułatwiać, nie blokować.
- **Testowalność od początku.** Komponenty i moduły piszemy tak, by łatwo było je testować (jasne granice, brak ukrytych zależności).
- **Brak overengineeringu.** Nie wprowadzamy Kubernetes, mikroserwisów ani złożonej infrastruktury, dopóki nie pojawi się konkretny powód edukacyjny.

---

## 2. Zakres (Scope)

### 2.1 W zakresie obecnego etapu (Etap 1 — Frontend)

- Jedna strona / jeden widok: **profil użytkownika**.
- Statyczne dane profilu (na sztywno w kodzie lub w lokalnym pliku/`localStorage`), bez backendu.
- Podstawowa interaktywność (edycja profilu, wczytanie zdjęcia z dysku — lokalnie, bez wysyłki na serwer).
- Komplet narzędzi DevOps wokół frontendu (patrz sekcja 6 i 7).

### 2.2 Poza zakresem obecnego etapu (świadomie odłożone)

- Backend (Express) — **nie implementujemy teraz**, ale projektujemy frontend tak, by integracja była łatwa (patrz 5.3).
- Baza danych (MongoDB) — planowana, nieimplementowana.
- ~~Uwierzytelnianie / autoryzacja, wielu użytkowników.~~ → w zakresie **Etapu 4.5** (logowanie e-mail + hasło, prywatny profil każdego użytkownika; role i panel admina nadal poza zakresem).
- Realne przechowywanie i hosting zdjęć (CDN/storage).

### 2.3 Plan rozwoju (kolejne etapy — orientacyjnie)

| Etap | Zakres | Główny nacisk DevOps |
|------|--------|----------------------|
| 1 | Frontend (ten dokument) | Build, lint, testy jednostkowe + E2E, pierwszy pipeline CI |
| 2 | Backend Express + API profilu | Testy integracyjne, kontrakt API, build wielu artefaktów |
| 3 | Integracja z MongoDB | Migracje, testy z bazą (np. kontenery testowe), seedy danych |
| 4 | Konteneryzacja (Docker) | Obrazy, docker-compose, środowiska lokalne = prod-like |
| 4.5 | Uwierzytelnianie (Better Auth) i profil per użytkownik | Sekrety poza repo, walidacja konfiguracji, migracje indeksów, testy bezpieczeństwa (pozytywne i negatywne) |
| 5 | Wdrożenia na środowiska (dev/staging/prod) | CD, promocja artefaktów, sekrety, zmienne środowiskowe |
| 6 | Obserwowalność i jakość | Logi, metryki, coverage gates, ewentualnie analiza statyczna |
| 7 | Kubernetes + GitOps (Argo CD) | Klaster (kind), manifesty, GitOps pull-based, promocja przez PR, rollback przez `git revert`, atestacje obrazów |

> Tabela jest orientacyjna i będzie aktualizowana. Kolejność etapów może się zmienić.

### 2.4 Specyfikacje i plany implementacji (linki)

Szczegółowe projekty techniczne i plany powstają per etap w `docs/superpowers/`. Decyzje architektoniczne od Etapu 4.5 — w [`docs/adr/`](docs/adr/README.md). Projekt UI — w [`docs/design/`](docs/design/).

| Etap | Spec (projekt techniczny) | Plan implementacji |
|------|---------------------------|--------------------|
| 1 — Frontend | [2026-06-04-etap1-frontend-profilu-design.md](docs/superpowers/specs/2026-06-04-etap1-frontend-profilu-design.md) | [2026-06-04-etap1-frontend-profilu.md](docs/superpowers/plans/2026-06-04-etap1-frontend-profilu.md) |
| 2 — Backend + API | [2026-06-10-etap2-backend-design.md](docs/superpowers/specs/2026-06-10-etap2-backend-design.md) | [2026-06-10-etap2-backend.md](docs/superpowers/plans/2026-06-10-etap2-backend.md) |
| 3 — MongoDB | [2026-06-11-etap3-mongodb-design.md](docs/superpowers/specs/2026-06-11-etap3-mongodb-design.md) | [2026-06-11-etap3-mongodb.md](docs/superpowers/plans/2026-06-11-etap3-mongodb.md) |
| 4 — Docker | [2026-06-11-etap4-docker-design.md](docs/superpowers/specs/2026-06-11-etap4-docker-design.md) | [2026-06-11-etap4-docker.md](docs/superpowers/plans/2026-06-11-etap4-docker.md) |
| 4.5 — Uwierzytelnianie | [2026-11-22-etap4-5-auth-design.md](docs/superpowers/specs/2026-11-22-etap4-5-auth-design.md) | [2026-11-22-etap4-5-auth.md](docs/superpowers/plans/2026-11-22-etap4-5-auth.md) |
| 5 — Wdrożenia (CD) | [2026-06-17-etap5-wdrozenia-design.md](docs/superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) | [2026-06-17-etap5-wdrozenia.md](docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md) |
| 6 — Obserwowalność i jakość | [2026-06-17-etap6-obserwowalnosc-jakosc-design.md](docs/superpowers/specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md) | [2026-06-17-etap6-obserwowalnosc-jakosc.md](docs/superpowers/plans/2026-06-17-etap6-obserwowalnosc-jakosc.md) |
| 7 — Kubernetes + GitOps | [2026-11-22-etap7-kubernetes-gitops-design.md](docs/superpowers/specs/2026-11-22-etap7-kubernetes-gitops-design.md) (zalążek) | _(po brainstormingu)_ |

---

### 2.5 Backlog — pomysły odłożone do kolejnych etapów

Pomysły zgłoszone, ale świadomie przesunięte. Każdy ma etap docelowy; przy brainstormingu tego etapu trafiają do jego specu (albo zostają odrzucone z powodem).

| Pomysł | Co daje | Etap docelowy | Źródło |
|---|---|---|---|
| Skan obrazów Trivy (SARIF do zakładki Security) | Znane podatności (CVE) w obrazach przed wdrożeniem | 6 | review specu Etapu 5 (2026-11-22) |
| ~~Przypinanie akcji GitHub po SHA + Dependabot `github-actions`~~ | Ochrona łańcucha dostaw CI przed podmianą akcji | **zrealizowane** przed Etapem 5 w hardeningu CI (PR #12, 2026-11-24; [plan](docs/superpowers/plans/2026-11-24-ci-hardening.md)) | review specu Etapu 5 (2026-11-22) |
| Metryki DORA z Deployments API (częstotliwość wdrożeń, lead time, odsetek porażek) | Mierzalna jakość procesu dostarczania | 6 | review specu Etapu 5 (2026-11-22) |
| Atestacje obrazów (provenance, SBOM) i ich weryfikacja przy wdrożeniu | Sprawdzalne pochodzenie i skład obrazu | 7 | review specu Etapu 5 (2026-11-22) |
| Rollback: ponowne wdrożenie starego digestu (`workflow_dispatch`) vs `git revert` w GitOps | Porównanie dwóch modeli cofania wersji | 7 | review specu Etapu 5 (2026-11-22) |
| release-please (automatyczny semver i PR wydania) | Wersjonowanie z Conventional Commits bez ręcznego tagowania | 7 | review specu Etapu 5 (2026-11-22) |

---

## 3. Persona i kontekst użytkownika (lekko)

Aplikacja jest jednoosobowa i demonstracyjna. Nie ma realnych użytkowników końcowych. Mimo to projektujemy ekran tak, jakby był prawdziwym profilem — żeby testy E2E miały sensowne scenariusze.

---

## 4. Wymagania funkcjonalne (Etap 1)

Identyfikatory (FR-x) ułatwią późniejsze powiązanie wymagań z testami.

| ID | Wymaganie | Kryterium akceptacji (skrót) |
|----|-----------|------------------------------|
| FR-1 | Widok profilu wyświetla: zdjęcie, imię, nazwisko, email, opis ("About me"). | Wszystkie pola widoczne przy danych domyślnych. |
| FR-2 | Widok zawiera przycisk **„Edytuj profil”**. | Przycisk widoczny i klikalny. |
| FR-3 | Kliknięcie „Edytuj profil” przełącza widok w tryb edycji (pola edytowalne). | Pola tekstowe stają się edytowalne; pojawia się akcja zapisu/anulowania. |
| FR-4 | Użytkownik może edytować imię, nazwisko, email i opis, a następnie zapisać zmiany. | Po zapisaniu widok pokazuje nowe wartości. |
| FR-5 | Użytkownik może wczytać zdjęcie z dysku lokalnego. | Po wybraniu pliku graficznego podgląd aktualizuje się natychmiast (lokalnie, bez backendu). |
| FR-6 | Walidacja pola email (poprawny format). | Niepoprawny email blokuje zapis i pokazuje komunikat. |
| FR-7 | Trwałość danych między odświeżeniami strony przez `localStorage`. | Po odświeżeniu strony zmiany są zachowane. |

> FR-6 i FR-7 to dobre, „testowalne” wymagania — dają konkretne scenariusze dla testów jednostkowych i E2E. FR-7 (`localStorage`) jest w zakresie Etapu 1 zgodnie z decyzją (sekcja 8.1).

### 4.1 Wymagania funkcjonalne (Etap 2 — Backend + API)

Szczegóły projektowe: [spec Etapu 2](docs/superpowers/specs/2026-06-10-etap2-backend-design.md).

| ID | Wymaganie | Kryterium akceptacji (skrót) |
|----|-----------|------------------------------|
| FR-8 | Trwałość profilu przez backend w pliku JSON na dysku; po ponownym otwarciu aplikacji wczytuje się ostatnio zapisany profil. | Po zapisie i restarcie aplikacji/serwera widać ostatnie dane (zastępuje `localStorage` z FR-7 jako mechanizm trwałości). |
| FR-9 | Przy pierwszym uruchomieniu (brak zapisanych danych) profil ma puste wartości — bez danych i bez zdjęcia. **Etap 4.5:** nowe konto ma pusty profil z wyjątkiem e-maila kontaktowego = e-mail logowania. | Czysty stan → puste pola, brak zdjęcia (zmienia domyślny seed z FR-1); nowe konto → e-mail kontaktowy wypełniony. |
| FR-10 | Zdjęcie profilowe jest wysyłane na backend i zapisywane jako plik; po zapisaniu serwowane z backendu. | Po zapisie profilu zdjęcie utrwalone i widoczne po reloadzie (rozszerza FR-5 o trwałość serwerową). |
| FR-11 | Edycja profilu z przyciskami **Zapisz** / **Anuluj**; „Anuluj" odrzuca niezapisane zmiany, w tym wybrane, niewysłane zdjęcie. | Po „Anuluj" backend i widok bez zmian; brak osieroconego pliku na serwerze. |
| FR-12 | Walidacja email również po stronie serwera. | `PUT` z niepoprawnym email zwraca błąd i nie zapisuje (rozszerza FR-6). |
| FR-13 | Możliwość usunięcia profilu (reset do stanu pustego). **Etap 4.5:** dotyczy profilu zalogowanego użytkownika. | `DELETE` czyści dane i zdjęcie → stan „pierwsze uruchomienie"; profile innych użytkowników bez zmian. |

> **Etap 3:** mechanizm trwałości z FR-8 (plik JSON) zostaje zastąpiony przez **MongoDB**; kryteria akceptacji FR-8…FR-13 pozostają w mocy (zmienia się tylko backend trwałości). Szczegóły: [spec Etapu 3](docs/superpowers/specs/2026-06-11-etap3-mongodb-design.md).

### 4.2 Wymagania funkcjonalne (Etap 4.5 — Uwierzytelnianie)

Szczegóły projektowe: [spec Etapu 4.5](docs/superpowers/specs/2026-11-22-etap4-5-auth-design.md), decyzje: [ADR-0001…0010](docs/adr/README.md). Każde FR ma w E2E test pozytywny i negatywny (ID w nazwie testu).

| ID | Wymaganie | Kryterium akceptacji (skrót) |
|----|-----------|------------------------------|
| FR-14 | Logowanie e-mail + hasło. | Poprawne dane → widok profilu; złe → komunikat „Niepoprawny e-mail lub hasło", bez ujawniania, czy konto istnieje. |
| FR-15 | Niezalogowany widzi tylko ekran logowania; API profilu bez sesji zwraca 401. | `GET/PUT/DELETE /api/profile` i `/api/profile/avatar` bez ciasteczka → 401. |
| FR-16 | Wylogowanie. | Po „Wyloguj" widok logowania; stare ciasteczko nie daje dostępu do API. |
| FR-17 | Brak publicznej rejestracji; konta tworzy, usuwa i resetuje im hasło właściciel przez CLI (`create`/`set-password`/`delete`). Reset hasła unieważnia wszystkie sesje użytkownika; resetu hasła przez e-mail nie ma. | `POST /api/auth/sign-up/email` odrzucony; `create` tworzy konto, które może się zalogować; po `set-password` stare ciasteczko → 401. |
| FR-18 | Profil i avatar są prywatne: użytkownik widzi i zmienia wyłącznie własne. | Użytkownik A nie odczyta ani nie zmieni profilu/avatara B żadnym endpointem. |
| FR-19 | Usunięcie konta usuwa profil, avatar i sesje. | Po `delete` sesja usuniętego → 401; brak jego dokumentu profilu i katalogu avatara. |

---

## 5. Wymagania niefunkcjonalne i architektura frontendu

### 5.1 Stos technologiczny (Etap 1)

| Warstwa | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Framework UI | **Vue 3** (Composition API, `<script setup lang="ts">`) | Zgodnie z preferencją. Nowoczesny standard Vue. |
| Język | **TypeScript** | Decyzja v0.2. Typowanie ułatwia testowanie i utrwala kontrakt danych — wartościowe przy nauce SDLC. |
| Build / dev server | **Vite** | De facto standard dla Vue 3; szybki build i HMR; natywne wsparcie TS; wygodny w CI. |
| Style | **Tailwind CSS** | Szybki, spójny styling utility-first; mało własnego CSS do utrzymania. |
| Testy jednostkowe/komponentów | **Vitest** + **Vue Test Utils** | Natywne dla ekosystemu Vite/Vue, wsparcie TS, szybkie, prosty CI. |
| Testy E2E / UI | **Playwright** | Zgodnie z wymaganiem; świetne wsparcie CI i raportowanie. |
| Lint / format | **ESLint** + **Prettier** | Spójność kodu, brama jakości w CI; wymuszane pre-commit przez Husky + lint-staged. |
| Git hooks | **Husky** + **lint-staged** + **commitlint** | Conventional Commits i kontrola jakości jeszcze przed pushem. |
| Menedżer pakietów | **npm** | Decyzja v0.2. |

### 5.2 Styl i UX

- Design **nowoczesny, ale stonowany** — czysty layout, czytelna typografia, umiar w kolorach i animacjach.
- Responsywność: poprawne wyświetlanie na desktopie i mobile (mobile-friendly, niekoniecznie pełen mobile-first).
- Podstawowa dostępność (a11y): etykiety pól, kontrast, obsługa klawiatury dla akcji edycji.
- Styling: **Tailwind CSS** (utility-first), minimum własnego CSS.

### 5.3 Gotowość na backend (bez implementacji teraz)

Frontend projektujemy tak, by przyszła integracja z **Express + MongoDB** była łatwa:

- **Warstwa dostępu do danych odizolowana** w jednym module (np. `services/profileService.ts`) z funkcjami typu `getProfile()` / `updateProfile()`. Na Etapie 1 czytają/zapisują `localStorage`; na Etapie 2 zostaną podmienione na wywołania HTTP — bez zmian w komponentach.
- **Konfiguracja przez zmienne środowiskowe** (np. `VITE_API_BASE_URL`), nawet jeśli teraz nieużywana — przyzwyczaja do wzorca „config zależny od środowiska”, kluczowego w DevOps.
  - **Etap 4.5:** `VITE_API_BASE_URL` usunięty — frontend i API zawsze pod jednym originem (proxy Vite / nginx), bo sesja jest w ciasteczku ([ADR-0002](docs/adr/0002-jeden-origin-spa-api.md)). Konfiguracja środowiskowa żyje teraz po stronie backendu, walidowana przy starcie ([ADR-0004](docs/adr/0004-walidacja-env-zod.md)).
- **Stabilny kształt modelu danych** profilu (patrz 5.4), żeby kontrakt z backendem był przewidywalny.

### 5.4 Model danych profilu (kontrakt roboczy)

```ts
interface Profile {
  firstName: string;
  lastName: string;
  email: string;        // walidowany format e-mail (FR-6 front, FR-12 serwer)
  aboutMe: string;
  avatarUrl: string;    // Etap 1: data URL / lokalny blob → Etap 2: ścieżka/URL pliku na backendzie
}
```

> Ten interfejs będzie podstawą przyszłego API i schematu w MongoDB. Zmiany kontraktu odnotowujemy w tym dokumencie.
>
> **Zmiana kontraktu (Etap 2):** semantyka `avatarUrl` zmienia się z base64 data URL (Etap 1) na **ścieżkę/URL pliku serwowanego przez backend** (np. `/api/profile/avatar`); pusty string = brak zdjęcia. Kształt interfejsu bez zmian.
>
> **Trwałość (Etap 3):** źródłem prawdy profilu jest teraz **dokument MongoDB** (kolekcja `profiles`, singleton `_id:'profile'`). Kształt `Profile` i semantyka `avatarUrl` bez zmian; zdjęcie nadal plikiem na dysku, w dokumencie trzymany jest tylko `avatarUrl`. Mechanizm trwałości FR-8 (plik JSON) zostaje **zastąpiony przez MongoDB** — analogicznie do tego, jak FR-8 zastąpił `localStorage` z FR-7.
>
> **Profil per użytkownik (Etap 4.5):** dokument profilu ma `_id = userId` (ID konta Better Auth), avatar leży w `uploads/<userId>/`. Kształt `Profile` w API bez zmian (bez `_id`). Singleton `_id:'profile'` przejmuje pierwsze konto utworzone przez CLI ([ADR-0005](docs/adr/0005-profil-per-uzytkownik.md)).

---

## 6. Wymagania jakościowe i strategia testów

Testy są **pierwszorzędnym celem projektu**, nie dodatkiem. Stosujemy piramidę testów.

| Poziom | Narzędzie | Co testujemy (Etap 1) |
|--------|-----------|------------------------|
| Jednostkowe / komponentowe | Vitest + Vue Test Utils | Logika walidacji (FR-6), renderowanie pól (FR-1), przełączanie trybu edycji (FR-3), zapis zmian (FR-4). |
| Integracyjne | Vitest (Etap 1) → realny backend/baza (Etap 2-3) | Na Etapie 1: interakcja komponentu z warstwą `profileService`. Później: realne wywołania API i baza. |
| UI / E2E | Playwright | Pełne ścieżki użytkownika: wyświetlenie profilu, edycja i zapis, wczytanie zdjęcia (FR-5), walidacja email. |

**Zasady:**

- Każde wymaganie funkcjonalne (FR-x) powinno mieć przypisany przynajmniej jeden test.
- Testy uruchamiane lokalnie **i** w CI tym samym poleceniem (np. `npm test`, `npm run test:e2e`).
- Pokrycie kodu (coverage) mierzone od początku; próg (gate) wprowadzimy stopniowo, by nie blokować nauki na starcie.

> **Etap 6 (plan):** wprowadzimy twardy próg pokrycia (70% lines/functions/branches/statements) jako bramę CI dla frontend i backend; spadek poniżej progu będzie czerwienić pipeline. Dojdą też dwie analizy statyczne: **CodeQL** (bezpieczeństwo) i **SonarCloud** (utrzymywalność). Szczegóły: [spec Etapu 6](docs/superpowers/specs/2026-06-17-etap6-obserwowalnosc-jakosc-design.md).

---

## 7. Wymagania DevOps / SDLC (rdzeń projektu)

To jest najważniejsza sekcja merytoryczna projektu — będzie rozbudowywana najbardziej.

### 7.1 Repozytorium i workflow

- Git, jedno repozytorium (monorepo gotowe na dodanie `backend/` obok `frontend/`).
- Strategia gałęzi: **GitHub Flow** (rekomendacja, patrz 8.2) — krótkie gałęzie + PR do `main`.
- **Conventional Commits**, wymuszane przez **commitlint** w hooku `commit-msg` (Husky). Ułatwi późniejszą automatyzację wersjonowania/changelogu.
- **Pre-commit (Husky + lint-staged):** ESLint + Prettier na plikach w commicie, by błędy łapać przed CI.

### 7.2 CI (Continuous Integration) — cel Etapu 1

Pipeline uruchamiany na każdy push / pull request, kroki:

1. Instalacja zależności (z cache).
2. Lint (ESLint) + format check (Prettier).
3. Sprawdzenie typów (`tsc --noEmit` / `vue-tsc`).
4. Testy jednostkowe/komponentowe (Vitest) + raport coverage.
5. Build produkcyjny (Vite).
6. Testy E2E (Playwright) na zbudowanej aplikacji.
7. Publikacja artefaktów (build, raporty testów) jako wynik pipeline'u.

> Platforma: **GitHub Actions** (workflow w `.github/workflows/`), uruchamiany na push i pull request.

### 7.3 CD i środowiska — cele kolejnych etapów

- **Trzy środowiska:** dev / staging / production (decyzja 8.1).
- **Hosting frontendu: kontener Docker** (obraz z aplikacją serwowaną statycznie, np. przez nginx) — ten sam obraz promowany między środowiskami.
- Promocja tego samego artefaktu między środowiskami (build once, deploy many).
- Konfiguracja per środowisko przez zmienne środowiskowe / sekrety (nigdy w repo).

### 7.4 Definicja ukończenia (Definition of Done) — Etap 1

Etap 1 uznajemy za zakończony, gdy:

- [ ] Aplikacja realizuje FR-1 … FR-7.
- [ ] Działa lint + format check + sprawdzenie typów (`vue-tsc`).
- [ ] Są testy jednostkowe pokrywające logikę i kluczowe komponenty.
- [ ] Jest co najmniej jeden scenariusz E2E (Playwright) przechodzący zielono.
- [ ] Istnieje działający pipeline CI uruchamiający lint + testy + build + E2E.
- [ ] README opisuje uruchomienie lokalne i strukturę projektu.

---

## 8. Decyzje i pytania otwarte

### 8.1 Decyzje podjęte

| # | Temat | Decyzja |
|---|-------|---------|
| 1 | Platforma CI/CD | **GitHub Actions.** |
| 2 | Język | **TypeScript** (zmiana w stosunku do v0.1 — wcześniej zakładano czysty JavaScript). Stos w sekcji 5.1 zaktualizowany. |
| 3 | Menedżer pakietów | **npm.** |
| 4 | Trwałość danych (Etap 1) | **`localStorage`** — bez backendu, dane przetrwają odświeżenie strony (FR-7 staje się wymaganiem obowiązkowym). |
| 5 | Style / UI | **Tailwind CSS.** |
| 6 | Konwencja commitów | **Conventional Commits**, wymuszane lokalnie przez **Husky** (git hooks) + **commitlint**. |
| 7 | Hooki jakości (pre-commit) | **Husky + lint-staged** uruchamiające **ESLint** i **Prettier** na plikach w commicie. |
| 8 | Liczba środowisk | **Trzy:** dev / staging / production. |
| 9 | Cel wdrożenia frontendu | **Kontener Docker** (serwowany np. przez nginx) — środowiska prod-like, CD do własnej infry. |
| 10 | Strategia gałęzi | **GitHub Flow** — krótkie gałęzie + PR do `main`. |

#### Decyzje — Etap 2 (Backend)

| # | Temat | Decyzja |
|---|-------|---------|
| 11 | Backend | **Express + TypeScript**, monorepo `backend/` obok `frontend/` (samodzielny, własny lockfile; bez npm workspaces). |
| 12 | Trwałość (Etap 2) | **Plik JSON na dysku** (`backend/data/profile.json`) — bez DB; MongoDB dopiero Etap 3. |
| 13 | Zdjęcie profilowe | **Osobny plik** na serwerze (multipart upload, limit rozmiaru, tylko obrazy); w JSON-ie ścieżka/URL. |
| 14 | Walidacja email | Również **po stronie serwera** (`PUT /api/profile`), nie tylko na froncie. |
| 15 | Strategia E2E | **Full-stack** — Playwright przeciw prawdziwemu backendowi; reset stanu przez realny `DELETE /api/profile`. |
| 16 | Artefakty buildu | **Build wielu artefaktów:** osobne `frontend-dist` i `backend-dist` (lekkie: `dist` + pliki `package*`, bez `node_modules`). |

#### Decyzje — Etap 3 (MongoDB)

| # | Temat | Decyzja |
|---|-------|---------|
| 17 | Co trafia do Mongo | **Profil** (dokument-singleton `_id:'profile'`); **zdjęcie zostaje plikiem na dysku** (jak Etap 2). |
| 18 | Sterownik / dostęp do bazy | **Mongoose** (ODM); walidacja email pozostaje w **Zod** na granicy HTTP — bez duplikacji w schemacie Mongoose. |
| 19 | Migracje | **migrate-mongo**; migracja #1 = utworzenie kolekcji + idempotentny import legacy `profile.json` (z `down`). |
| 20 | Testy z bazą | **Testcontainers** (`@testcontainers/mongodb`) — realny `mongod` w testach integracyjnych i E2E. |
| 21 | Mongo lokalnie (dev) | **`backend/docker-compose.yml`** z jedną usługą `mongo` + nazwany wolumen; pełny stack (konteneryzacja aplikacji) dopiero Etap 4. |
| 22 | Seedy | **Idempotentny `npm run seed`** (upsert profilu demo dla dev/staging). |

#### Decyzje — Etap 4 (Docker)

| # | Temat | Decyzja |
|---|-------|---------|
| 23 | Zakres `docker compose up` | **Pełny stack**: mongo + backend + frontend-nginx; jedno polecenie = kompletna aplikacja prod-like. |
| 24 | Budowa obrazów | **Multi-stage builds** (builder → runtime) dla backend i frontend; lekkie obrazy bez devDependencies i kodu źródłowego. |
| 25 | Serwowanie frontendu | **nginx:alpine** — pliki statyczne + `proxy_pass /api/ → backend:3000`; SPA routing przez `try_files`. |
| 26 | Rejestr obrazów | **GHCR** (`ghcr.io/{owner}/teamable-{backend,frontend}`); push tylko na `main` po zielonych testach; tag SHA + `latest`. |
| 27 | Non-root w kontenerze | **`USER app`** w obu Dockerfile'ach; `addgroup`/`adduser` na etapie runtime. |
| 28 | Healthchecks | Backend: `/api/health` (Etap 3); Mongo: `mongosh ping`; `depends_on: service_healthy` — deterministyczna kolejność startu. |
| 29 | E2E | **Bez zmian** — Testcontainers jak w Etapie 3; docker-compose to narzędzie dev; smoke testy na compose — Etap 5. |

#### Decyzje — Etap 5 (Wdrożenia / CD)

| # | Temat | Decyzja |
|---|-------|---------|
| 30 | Cel wdrożenia | **Ephemeral w CI**: weryfikacja podpisów → `pull` → `up` → smoke → `down`; nic nie żyje poza pipeline'em. |
| 31 | Trigger CD | `main`: `docker` → `sign` → deploy dev → staging (manifest pary digestów); tag `v*`: `check-staging` (para z manifestu staging dla SHA) → re-tag → production (approval gate) → GitHub Release. Joby w `ci.yml`, kroki w reużywalnym `deploy.yml` — rewizja 2026-11-22, [ADR-0012](docs/adr/0012-promocja-obrazu-reuzywalny-deploy.md). |
| 32 | Promowany artefakt | **Ten sam obraz GHCR** (build once, deploy many); para digestów z buildu do produkcji (outputy `docker` → manifest staging), nigdy rozwiązywana z etykiety; digest w podsumowaniu joba; deploy nigdy nie buduje (rewizja 2026-11-28). |
| 33 | Sekrety i zmienne | **GitHub Environments** (dev/staging tylko z `main`, production tylko z tagów `v*` + required reviewers). |
| 34 | Dane per środowisko | dev/staging: `SEED_ON_START=true` → backend zakłada/resetuje konto demo przy starcie (`seedDemoUser`); production: czysty start (FR-9), konta przez CLI. |
| 35 | Flagi runtime | `SEED_ON_START` on/off per środowisko; `LOG_LEVEL` przeniesiony do Etapu 6 (decyzja 38) — rewizja 2026-11-22. |
| 36 | Izolacja środowisk | Osobne compose project (`teamable_dev`/`_staging`/`_production`), różne porty, `concurrency` per środowisko. |
| 37 | Smoke test | Health + SPA + `/api/profile` bez sesji → 401 + logowanie złym hasłem → 401 (nie 403); dev/staging także logowanie kontem demo → profil 200. Błąd czerwieni job. |
| 56 | Podpisy obrazów | cosign keyless (OIDC) **i** kluczem w osobnym jobie `sign`; klucz w sekretach środowiska `signing` (tylko `main`), nie repo — zmiana 2026-11-27; deploy weryfikuje oba przed uruchomieniem. Numer po #55 (Graphify). [ADR-0013](docs/adr/0013-podpisy-obrazow-cosign.md) |
| 57 | Release | Tag `vX.Y.Z` → re-tag obrazów bez rebuildu → po wdrożeniu prod `gh release create --generate-notes`. |
| 58 | Kubernetes + GitOps | Osobny **Etap 7** (Kubernetes + Argo CD); Etap 5 zostaje przy Compose. |

#### Decyzje — Etap 6 (Obserwowalność i jakość)

| # | Temat | Decyzja |
|---|-------|---------|
| 38 | Logowanie | **pino** — structured JSON z `requestId`; `LOG_LEVEL` z env (per środowisko). |
| 39 | Metryki | **prom-client** — `GET /api/metrics` (default Node metrics + histogram latencji HTTP). |
| 40 | Stack monitoringu | **Prometheus + Grafana** jako usługi w compose (provisioning datasource + dashboard). |
| 41 | Coverage gate | **Vitest** próg 70% (frontend + backend); spadek łamie CI; raport lcov. |
| 42 | Analiza statyczna #1 | **CodeQL** (GitHub native) — bezpieczeństwo, wynik w zakładce Security. |
| 43 | Analiza statyczna #2 | **SonarCloud** — utrzymywalność, code smells, quality gate; konsumuje lcov. |
| 49 | Analiza dynamiczna (DAST) | **OWASP ZAP baseline** w CI przeciw stackowi compose (dopisane 2026-11-22; numer po zarezerwowanych #44–48 Etapu 4.5). |

#### Decyzje — Etap 4.5 (Uwierzytelnianie)

Od tego etapu pełna treść decyzji (kontekst, opcje, konsekwencje, dowody) jest w ADR-ach; tabela jest skrótem. Numer #49 zajęła wcześniej decyzja Etapu 6 (OWASP ZAP), stąd przeskok 48 → 50.

| # | Temat | Decyzja | ADR |
|---|-------|---------|-----|
| 44 | Uwierzytelnianie | **Better Auth**, e-mail + hasło, zamknięta rejestracja, konta przez CLI, adapter MongoDB bez transakcji. | [0001](docs/adr/0001-better-auth.md) |
| 45 | Origin | SPA i API pod jednym originem, bez CORS; `VITE_API_BASE_URL` usunięty. | [0002](docs/adr/0002-jeden-origin-spa-api.md) |
| 46 | CSRF | `originCheck`: mutacje `/api` z obcym `Origin` → 403. | [0003](docs/adr/0003-ochrona-csrf-origin.md) |
| 47 | Konfiguracja | Zod waliduje env przy starcie; brak sekretu = brak startu. | [0004](docs/adr/0004-walidacja-env-zod.md) |
| 48 | Dane | Profil per użytkownik (`_id = userId`), przejęcie singletonu. | [0005](docs/adr/0005-profil-per-uzytkownik.md) |
| 50 | Indeksy | Indeksy kolekcji auth zakładane migracją; duplikaty blokują start. | [0006](docs/adr/0006-indeksy-auth-w-migracji.md) |
| 51 | Zależności | Jedna wersja sterownika `mongodb` (przypięta do wersji z mongoose). | [0007](docs/adr/0007-jeden-sterownik-mongodb.md) |
| 52 | UI | Projekt „Identyfikator”: tokeny w `@theme` Tailwind 4, fonty serwowane lokalnie. | [0008](docs/adr/0008-ui-identyfikator-tokeny-fonty.md) |
| 53 | E2E auth | Projekt `setup` + `storageState`, sekrety generowane na przebieg, kontrprzykłady jako dowód testów negatywnych. | [0009](docs/adr/0009-e2e-auth-storagestate-sekrety-per-przebieg.md) |
| 54 | Przekazanie projektu | Paczka dla projektanta: tokeny W3C (DTCG), makieta HTML, zrzuty — zamiast natywnego `.fig`. | [0010](docs/adr/0010-przekazanie-projektu-ui-tokeny-dtcg.md) |

#### Decyzje — narzędzia (Graphify)

| # | Temat | Decyzja | ADR |
|---|-------|---------|-----|
| 55 | Graf wiedzy | Graphify: commitowany `graphify-out/graph.json` z merge driverem, aktualizacja w husky pre-commit, strict guard dla agenta. | [0011](docs/adr/0011-graf-wiedzy-graphify.md) |

#### Decyzje — runtime

| # | Temat | Decyzja | ADR |
|---|-------|---------|-----|
| 59 | Runtime Node.js | Node 24 LTS w CI (`node-version: 24`), obrazach (`node:24-alpine`), `engines` i `@types/node` 24; Node 20 bez wsparcia od 04.2026. | [0014](docs/adr/0014-runtime-node-24.md) |

Numery 56–58 (i ADR-0012, ADR-0013) rezerwuje spec Etapu 5 na gałęzi `docs/etap5-spec-rewrite`, stąd przeskok 55 → 59.

### 8.2 Pytania nadal otwarte

- **Etap 6:** czy `GET /api/metrics` ma być publiczny, czy za uwierzytelnianiem / tylko w sieci wewnętrznej (po Etapie 4.5 reszta API wymaga sesji) — decyzja w specu Etapu 6.

Nowe pytania dopisujemy tutaj w miarę rozwoju projektu.
