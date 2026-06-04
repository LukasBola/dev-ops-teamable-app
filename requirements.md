# Teamable — Wymagania projektu

> **Status dokumentu:** v0.2 (decyzje technologiczne podjęte, żywy dokument)
> **Ostatnia aktualizacja:** 2026-06-04
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
- Uwierzytelnianie / autoryzacja, wielu użytkowników.
- Realne przechowywanie i hosting zdjęć (CDN/storage).

### 2.3 Plan rozwoju (kolejne etapy — orientacyjnie)

| Etap | Zakres | Główny nacisk DevOps |
|------|--------|----------------------|
| 1 | Frontend (ten dokument) | Build, lint, testy jednostkowe + E2E, pierwszy pipeline CI |
| 2 | Backend Express + API profilu | Testy integracyjne, kontrakt API, build wielu artefaktów |
| 3 | Integracja z MongoDB | Migracje, testy z bazą (np. kontenery testowe), seedy danych |
| 4 | Konteneryzacja (Docker) | Obrazy, docker-compose, środowiska lokalne = prod-like |
| 5 | Wdrożenia na środowiska (dev/staging/prod) | CD, promocja artefaktów, sekrety, zmienne środowiskowe |
| 6 | Obserwowalność i jakość | Logi, metryki, coverage gates, ewentualnie analiza statyczna |

> Tabela jest orientacyjna i będzie aktualizowana. Kolejność etapów może się zmienić.

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
- **Stabilny kształt modelu danych** profilu (patrz 5.4), żeby kontrakt z backendem był przewidywalny.

### 5.4 Model danych profilu (kontrakt roboczy)

```ts
interface Profile {
  firstName: string;
  lastName: string;
  email: string;        // walidowany format e-mail (FR-6)
  aboutMe: string;
  avatarUrl: string;    // na Etapie 1: data URL / lokalny blob
}
```

> Ten interfejs będzie podstawą przyszłego API i schematu w MongoDB. Zmiany kontraktu odnotowujemy w tym dokumencie.

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

### 8.2 Pytania nadal otwarte

Brak — wszystkie kluczowe decyzje na Etap 1 zostały podjęte. Nowe pytania dopisujemy tutaj w miarę rozwoju projektu.
