# Etap 1 — Frontend profilu + CI — projekt techniczny

> **Data:** 2026-06-04
> **Status:** zaakceptowany (gotowy do planu implementacji)
> **Źródło wymagań:** [../../../requirements.md](../../../requirements.md)
> **Charakter:** projekt edukacyjny — aplikacja jest poligonem do nauki DevOps. Aplikacja świadomie prosta, nacisk na testy i CI.

## Cel etapu

Zbudować jednowidokową aplikację profilu użytkownika (Vue 3 + TypeScript + Tailwind) realizującą FR-1…FR-7, z kompletem testów (Vitest + Vue Test Utils + Playwright) i pierwszym pipeline'em CI (GitHub Actions). **Docker i CD są poza zakresem tej rundy** (etapy 4–5 w `requirements.md`).

## Decyzje projektowe (z brainstormingu)

| Temat | Decyzja | Uzasadnienie |
|-------|---------|--------------|
| Zakres rundy | Aplikacja + CI (bez Docker/CD) | Zgodne z Etapem 1 w requirements |
| Tryb edycji | **Podmiana widoków** (read ↔ form) | Czyste granice komponentów, najłatwiejsze testy w izolacji |
| Zarządzanie stanem | **Composable `useProfile()`** (bez Pinii) | Wystarcza dla jednego widoku; brak overengineeringu |
| Układ repo | **Monorepo z `frontend/`** od razu | Dodanie `backend/` w Etapie 2 bez reorganizacji |

## 1. Struktura repo i plików

Monorepo; aplikacja w `frontend/`. Husky/commitlint/lint-staged w roocie (tam `.git`).

```text
teamable/
  .github/workflows/ci.yml      # GitHub Actions CI
  docs/superpowers/specs/        # specyfikacje
  frontend/
    src/
      components/
        ProfileCard.vue          # podgląd (read-only)
        ProfileForm.vue          # edycja + walidacja + upload zdjęcia
      composables/useProfile.ts  # reaktywny stan + load/save
      services/profileService.ts # localStorage (z domyślnym seedem)
      utils/validation.ts        # isValidEmail()
      types/profile.ts           # interface Profile
      App.vue                    # przełącznik podgląd ↔ edycja
      main.ts
    e2e/                         # testy Playwright
    *.spec.ts                    # testy jednostkowe/komponentowe (obok kodu)
    index.html, package.json, vite.config.ts, tsconfig.json,
    tailwind.config.js, playwright.config.ts, eslint.config.js, .prettierrc
  package.json                   # root: husky, commitlint, lint-staged
  README.md, requirements.md
```

## 2. Komponenty i przepływ danych

Przepływ jednokierunkowy (props w dół, eventy w górę):

- **`App.vue`** — trzyma flagę `isEditing`, woła `useProfile()`. Renderuje `ProfileCard` (podgląd) albo `ProfileForm` (edycja). Obsługuje `edit`/`save`/`cancel`.
- **`useProfile()`** — zwraca reaktywne `profile` oraz `save(profile)`. Deleguje do `profileService`. Jedyny most do warstwy danych.
- **`profileService.ts`** — `getProfile(): Profile`, `saveProfile(p: Profile): void` na `localStorage` (klucz `teamable.profile`). Gdy brak danych → zwraca **domyślny profil (seed)**. Na Etapie 2 ciało funkcji zostanie podmienione na wywołania HTTP, bez zmian w komponentach.
- **`ProfileCard.vue`** — `props: profile`, `emit('edit')`. Czysto prezentacyjny.
- **`ProfileForm.vue`** — `props: profile`, robi **lokalną kopię** do edycji, waliduje email, `emit('save', profile)` / `emit('cancel')`. Upload zdjęcia: FileReader → data URL → natychmiastowy podgląd.

### Model danych

```ts
interface Profile {
  firstName: string;
  lastName: string;
  email: string;     // walidowany format e-mail (FR-6)
  aboutMe: string;
  avatarUrl: string; // Etap 1: data URL / lokalny blob
}
```

## 3. Walidacja i obsługa błędów

- **Email (FR-6):** `isValidEmail()` w `utils/validation.ts` (czysta funkcja → łatwy unit test). Niepoprawny email blokuje „Zapisz" i pokazuje komunikat inline.
- **Zdjęcie (FR-5):** akceptujemy `image/*`, odczyt jako data URL, podgląd od razu (bez backendu).
- **localStorage defensywnie:** błąd odczytu/parse → fallback do seeda, by uszkodzony wpis nie wywalił aplikacji.

## 4. Strategia testów (mapowanie FR → test)

| Poziom | Narzędzie | Co testujemy | FR |
|--------|-----------|--------------|-----|
| Unit | Vitest | `isValidEmail` (poprawne/błędne przypadki) | FR-6 |
| Unit | Vitest | `profileService`: seed gdy pusto, zapis+odczyt, fallback (mock localStorage) | FR-7 |
| Komponentowe | Vue Test Utils | `ProfileCard` renderuje pola; emituje `edit` | FR-1, FR-2, FR-3 |
| Komponentowe | Vue Test Utils | `ProfileForm`: edycja + `save`; blokada przy złym emailu | FR-4, FR-6 |
| E2E | Playwright | podgląd → edycja → zapis → reload → dane zostają | FR-3, FR-4, FR-7 |
| E2E | Playwright | upload zdjęcia → podgląd się zmienia | FR-5 |

Każde FR ma ≥1 test. Coverage mierzony od startu, bez twardego progu (gate) na tym etapie.

## 5. CI — `.github/workflows/ci.yml` (GitHub Actions)

Trigger: `push` i `pull_request`. Na start jeden job (później rozbicie na joby):

1. checkout + `setup-node` z cache npm
2. `npm ci` (w `frontend/`)
3. lint (ESLint) + format check (Prettier)
4. typecheck (`vue-tsc --noEmit`)
5. testy jednostkowe/komponentowe + coverage
6. build (Vite)
7. instalacja przeglądarek Playwright + E2E na zbudowanej aplikacji
8. upload artefaktów (dist + raporty testów/coverage)

## 6. Kolejność implementacji (zarys pod plan)

1. **Scaffold:** `git init`, Vite+Vue+TS w `frontend/`, Tailwind, ESLint/Prettier, Husky+commitlint+lint-staged w roocie.
2. **Rdzeń (TDD):** `types/profile` → `utils/validation` → `services/profileService` → `composables/useProfile`.
3. **UI:** `ProfileCard` + `ProfileForm` + `App` (przełącznik podgląd/edycja).
4. **Funkcje:** upload zdjęcia + trwałość w localStorage.
5. **Testy E2E** (Playwright).
6. **CI** (GitHub Actions).
7. **README** (uruchomienie lokalne + struktura projektu).

## Definicja ukończenia (Etap 1)

- [ ] Aplikacja realizuje FR-1 … FR-7.
- [ ] Lint + format check + typecheck (`vue-tsc`) przechodzą.
- [ ] Testy jednostkowe/komponentowe pokrywają logikę i kluczowe komponenty.
- [ ] ≥1 scenariusz E2E (Playwright) zielony.
- [ ] Działający pipeline CI: lint + typecheck + testy + build + E2E.
- [ ] README opisuje uruchomienie lokalne i strukturę projektu.

## Poza zakresem (świadomie)

- Backend (Express), MongoDB, realne API.
- Docker, konteneryzacja, CD, wdrożenia na środowiska.
- Uwierzytelnianie, wielu użytkowników, hosting zdjęć (CDN/storage).
- Pinia (dodamy, gdy pojawi się współdzielony stan między widokami).
