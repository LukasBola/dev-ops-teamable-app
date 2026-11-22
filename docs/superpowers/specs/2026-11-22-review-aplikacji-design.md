# Review aplikacji (Etapy 1–4) + szablon review — projekt

> **Status:** projekt do akceptacji (po builder check)
> **Data:** 2026-11-22
> **Zakres:** proces review całej aplikacji Teamable przed Etapem 5 + szablon review wielokrotnego użytku

---

## 1. Intencja (dlaczego)

1. **Domknięcie Etapów 1–4 przed Etapem 5.** CD (Etap 5) będzie promować te same obrazy na dev/staging/production — błędy i luki z Etapów 1–4 przejdą na wszystkie środowiska. Teraz ich naprawa jest najtańsza.
2. **Nauka procesu review.** Proces ma być widoczny i powtarzalny: obszar po obszarze, z jawną metodą, dowodem i oceną ważności — nie „lista uwag z głowy".
3. **Aplikacja jak najlepsza** — w ramach zasad projektu (prostota aplikacji, dojrzałość procesu, brak overengineeringu).
4. **Porównanie modeli.** Cały kod Etapów 1–4 powstał z Opus 4.8; review prowadzi Opus 5.5. Chcemy uczciwie zobaczyć, co zostało przeoczone.
5. **Szablon review** gotowy do użycia w innych projektach.

## 2. Cele, nie-cele, anty-cele

**Cele**
- Ogólny szablon review (obszary, checklisty, skala ważności, format znaleziska, szablon raportu).
- Raport z review Teamable (Etapy 1–4) wykonany ściśle wg szablonu.
- Skrócone review specyfikacji i planów Etapów 5 i 6 (luki w projekcie, nie w kodzie).
- Triage: znaleziska pogrupowane w paczki naprawcze z kolejnością.
- Retrospektywa: poprawki szablonu wynikające z jego pierwszego użycia.

**Nie-cele**
- Naprawianie kodu w trakcie review. Review niczego nie zmienia w kodzie aplikacji. Naprawy to osobne cykle (brainstorm → plan → implementacja) per paczka.
- Implementacja Etapów 5/6.
- Dodawanie narzędzi/zależności do repo w ramach review (narzędzia uruchamiane jednorazowo przez `npx`/obrazy Docker, bez zmian w `package.json`).

**Anty-cele (porażka, nawet jeśli „technicznie zrobione")**
- Znaleziska bez dowodu (plik:linia, wynik komendy, reprodukcja) lub niezweryfikowane — fałszywe alarmy.
- Zgłaszanie świadomych decyzji z `requirements.md` jako błędów (np. brak auth / wielu użytkowników — 2.2). Takie rzeczy mogą wystąpić tylko jako *ryzyko do odnotowania* z uzasadnieniem, np. gdy decyzja przestaje być bezpieczna w kontekście Etapu 5.
- Rekomendacje sprzeczne z zasadą „brak overengineeringu" (np. „dodaj Kubernetes", „wprowadź OAuth").
- Generyczny zrzut checklisty („sprawdzono X: OK") bez faktycznej weryfikacji.
- Szablon przywiązany do Teamable (nazwy, stos) — wtedy nie nadaje się do innych projektów.

## 3. Ograniczenia

- Kontekst projektu: edukacyjny; dziś jednoosobowy i bez auth, docelowo wielu użytkowników z auth (3.1).
- **Model ekspozycji (decyzja użytkownika):** aplikacja **docelowo będzie publiczna w internecie**. Ważność ocenia się pod publiczny host z ruchem z internetu — mimo że spec Etapu 5 zakłada production wyłącznie efemeryczne w CI. Każde znalezisko S/H/O ma dodatkowo adnotację „ważność przy wdrożeniu tylko-CI (Etap 5 wg specy): …", żeby użytkownik mógł zdecydować, co blokuje Etap 5, a co dopiero publiczne wdrożenie. Brak auth (decyzja 2.2) nie jest błędem, ale raport opisuje go jako ryzyko publicznego wdrożenia (Info/Medium z uzasadnieniem). Rozjazd „docelowo publiczna" vs spec Etapu 5 (brak realnego hostingu) to znalezisko obszaru N.
- Stos: Vue 3 + Vite + Tailwind, Express 5 + TS, Mongoose/MongoDB 7, Docker + nginx, GitHub Actions.
- Dokumenty projektu po polsku → szablon i raport po polsku (moja decyzja; przetłumaczalne).
- Review działa na branchu `review/etap1-4`; commituje wyłącznie pliki w `docs/`.

### 3.1 Planowana zmiana: uwierzytelnianie (Better Auth)

- **Decyzja użytkownika:** do aplikacji dojdzie uwierzytelnianie przez **Better Auth**. Logować się będzie właściciel **i inni użytkownicy** — aplikacja przestaje być jednoosobowa (zmienia decyzję z `requirements.md` 2.2).
- **Wzorzec referencyjny:** projekt `codewithmosh/helpdesk` — Better Auth (email+hasło, sesja w cookie), SPA i API pod jednym originem (ADR-0007), CSRF przez sprawdzanie `Origin` (ADR-0008), walidacja env przez Zod (ADR-0009). W Teamable zamiast adaptera Prisma — adapter MongoDB.
- **Poza zakresem tego review:** projekt i budowa auth (role, rejestracja otwarta/zamknięta, kto widzi czyje profile). To osobny etap (roboczo „Etap 4.5 — Auth") z własnym brainstormingiem i planem; kolejność względem Etapu 5 ustalana w triage.
- **Wpływ na review:**
  - każde znalezisko ma pole **„Wpływ auth"**: `rozwiąże` (auth usunie problem) / `zmieni` (naprawa wygląda inaczej po auth — np. CORS i CSRF przy sesji w cookie) / `bez wpływu`. Triage nie planuje napraw, które auth i tak przebuduje;
  - obszar N obejmuje **gotowość kodu na auth i wielu użytkowników**: co w obecnym kodzie blokuje lub utrudnia dodanie auth. Kandydaci do weryfikacji: singleton profilu `_id:'profile'`, jeden plik avatara na serwer, endpointy bez pojęcia właściciela zasobu, `cors()` bez allowlisty (niezgodne z `credentials`), brak walidacji env, brak miejsca na sekret (`BETTER_AUTH_SECRET`) w compose/CI;
  - rekomendacje w obszarach S/H mają być spójne ze wzorcem z helpdesk (nie proponujemy rozwiązań, które trzeba będzie wyrzucić przy auth).

## 4. Rozważane podejścia

| Podejście | Opis | Kompromis |
|---|---|---|
| **A. Szablon → review wg szablonu → retrospektywa** ✅ | Najpierw ogólny szablon, potem review Teamable dokładnie wg niego, na końcu poprawki szablonu z doświadczenia. | Wolniejszy start; za to szablon jest od razu zwalidowany na realnym projekcie, a proces jawny (cel nauki). |
| B. Review → szablon wyciągnięty na końcu | Szybciej do znalezisk. | Szablon skrojony pod problemy Teamable; pomija obszary, które tu wypadły czysto. |
| C. Równoległe agenty per obszar | Najszybsze. | Najmniej nauki (widać wynik, nie metodę); duplikaty między obszarami do ręcznej deduplikacji. |

**Wybrane: A**, plus dwie propozycje zaakceptowane przez użytkownika:
- znacznik pochodzenia znaleziska (patrz 6.3) — uczciwe porównanie modeli,
- skrócone review specyfikacji Etapów 5 i 6.

## 5. Produkty (pliki)

```
docs/review/
  template/                         # ogólny, bez nazw z Teamable
    README.md                       # jak używać: proces, fazy, skala ważności, format znaleziska
    checklists.md                   # obszary + pytania kontrolne + metody weryfikacji
    report-template.md              # szkielet raportu do skopiowania
  2026-11-22-teamable-review.md     # raport z review Teamable (wypełniony szablon)
```

Ten dokument: `docs/superpowers/specs/2026-11-22-review-aplikacji-design.md`.

Szablon to zwykły Markdown używalny przez człowieka **i** przez agenta AI (README zawiera krótką sekcję „jak zlecić ten review agentowi"). *Moja decyzja* — bez budowy osobnego skilla Claude Code; można go zrobić później z tych plików.

## 6. Szablon — zawartość

### 6.1 Proces (fazy)

0. **Kontekst** — przeczytaj wymagania, specy, decyzje; spisz świadome nie-cele (żeby ich nie zgłaszać jako błędów) i model zagrożeń „lite" (kto/co może zaatakować, jakie dane są wrażliwe).
1. **Inwentaryzacja** — mapa systemu: komponenty, wejścia (endpointy, upload, env), przepływy danych, granice zaufania. Krótki diagram tekstowy.
2. **Przegląd obszar po obszarze** (6.2) — dla każdego obszaru: checklist + metoda (statyczna / narzędzie / dynamiczna) → znaleziska z dowodem.
3. **Weryfikacja** — każde znalezisko High/Critical ma reprodukcję albo wskazanie dokładnej ścieżki w kodzie; niepewne oznaczone poziomem pewności.
4. **Deduplikacja i triage** — scalenie duplikatów między obszarami; grupowanie w paczki naprawcze; kolejność.
5. **Raport** — wg `report-template.md`.
6. **Retrospektywa** — co w szablonie zbędne/brakujące → poprawka szablonu.

### 6.2 Obszary review (checklisty)

Każdy obszar w `checklists.md` ma: cel, pytania kontrolne, metody weryfikacji, typowe pułapki. Lista obszarów:

| # | Obszar | Przykładowe pytania kontrolne |
|---|---|---|
| R | **Wymagania i traceability** | Czy każde FR ma implementację i test? Czy kod robi coś, czego wymagania nie przewidują? Czy dokumentacja zgadza się z kodem (np. statusy etapów, opisy)? |
| B | **Poprawność / bugi** | Edge cases, wyścigi (race conditions), atomowość operacji wieloetapowych (plik + DB), obsługa błędów, stany przejściowe w UI, zgodność kontraktu front↔back. |
| S | **Bezpieczeństwo** (OWASP Top 10 / ASVS-lite, w granicach braku auth) | Walidacja na granicy zaufania, upload (typ wg treści vs MIME, rozmiar, nazwa, metadane EXIF), nagłówki bezpieczeństwa (CSP, X-Content-Type-Options…), CSRF, sekrety, auth do bazy, limity (DoS: rozmiar body, rate limit), wycieki w błędach, kontener (root, uprawnienia). |
| H | **API i HTTP (w tym CORS)** | Polityka CORS vs faktyczny model wdrożenia (same-origin przez nginx?), kody statusu, spójny format błędów, cache headers (avatar, index.html vs assety z hashem), zgodność proxy nginx z backendem (port, limity, timeouty). |
| P | **Wydajność** | Rozmiar bundla, Lighthouse (LCP/CLS), kompresja (gzip/brotli), cache statyków, obrazy (rozmiar avatara), zapytania do DB/indeksy, operacje synchroniczne/blokujące, N+1. |
| O | **Niezawodność i odporność** | Graceful shutdown, healthchecki (liveness vs readiness), zachowanie przy utracie DB, timeouty, restart policy, utrata danych (wolumeny), idempotencja migracji i seedów. |
| D | **Zależności i łańcuch dostaw** | `npm audit`, przestarzałe/nieutrzymywane pakiety, lockfile, wersje obrazów bazowych (pinning, EOL Node), skan obrazów (Trivy), pinning akcji GitHub, `permissions:` w workflow, sekrety w CI. |
| I | **Infrastruktura: Docker, compose, CI** | Dobre praktyki Dockerfile (warstwy, cache, `.dockerignore`, non-root faktycznie działający), compose (sieci, porty, wolumeny), poprawność i szybkość pipeline'u, artefakty, cache. |
| T | **Testy** | Pokrycie FR testami, jakość asercji, testy fałszywie zielone, izolacja/flakiness E2E, brakujące ścieżki błędów, czy CI uruchamia wszystkie testy. |
| Q | **Jakość kodu i utrzymywalność** | Typowanie (any, rzutowania), martwy kod, duplikacja (np. typ `Profile` w dwóch miejscach), spójność konwencji, konfiguracja lint/format. |
| U | **Frontend: UX i dostępność** | a11y (axe, klawiatura, focus, etykiety, kontrast), stany ładowania/błędu, responsywność, komunikaty dla użytkownika. |
| X | **Dokumentacja i DX** | README (uruchomienie od zera działa?), `.env.example` kompletne, Makefile/skrypty, onboarding. |
| N | **Gotowość na kolejne etapy** (review specyfikacji) | Czy specy następnych etapów mają luki, sprzeczności z obecnym kodem, nierealne założenia, brakujące decyzje (sekrety, rollback, migracje na prod)? |

### 6.3 Format znaleziska

```markdown
### SEC-03 — <krótki tytuł>
- **Obszar:** S  · **Ważność:** High · **Pewność:** wysoka/średnia/niska
- **Pochodzenie:** nowe | znane (opisane w <spec/plan>, nienaprawione) | regresja
- **Lokalizacja:** `ścieżka/plik.ts:42`
- **Dowód:** fragment kodu / komenda + wynik / kroki reprodukcji
- **Wpływ:** co realnie może się stać, w tym kontekście
- **Rekomendacja:** najmniejsza poprawka, która rozwiązuje problem
- **Koszt naprawy:** S / M / L
- **Ważność w alternatywnym kontekście:** (opcjonalne; w Teamable obowiązkowe dla S/H/O — „tylko-CI: Low")
- **Wpływ planowanych zmian:** rozwiąże / zmieni / bez wpływu (w Teamable: wpływ auth)
```

Szablon ma w fazie 0 krok **„planowane zmiany w systemie"** (np. dodanie auth, zmiana bazy) — ogólny odpowiednik pola wyżej, żeby review w innych projektach też nie rekomendowało napraw wyrzucanych za chwilę.

ID: prefiks obszaru (`REQ`, `BUG`, `SEC`, `HTTP`, `PERF`, `OPS`, `DEP`, `INF`, `TST`, `QLT`, `UX`, `DOC`, `NXT`) + numer.

**Pochodzenie** służy porównaniu modeli (*moja decyzja co do definicji*):
- **znane** — problem był już gdziekolwiek zapisany w repo lub na GitHubie: specy i plany, `requirements.md`, komentarze/TODO w kodzie, commit messages, wątki review w PR-ach (ludzie i Copilot) — i nie został naprawiony. W dowodzie podaj źródło.
- **nowe** — nigdzie wcześniej niezapisane (luka przeoczona przy budowie).
- **regresja** — zachowanie, które kiedyś działało (wg historii git lub testu/specy wcześniejszego etapu), a teraz nie działa.

### 6.4 Skala ważności

| Ważność | Definicja |
|---|---|
| **Critical** | Utrata/wyciek danych, zdalne wykonanie kodu, aplikacja nie działa na głównej ścieżce. Blokuje następny etap. |
| **High** | Realna podatność lub błąd na typowej ścieżce; łatwy do wywołania. Naprawić przed następnym etapem. |
| **Medium** | Błąd w przypadku brzegowym, słabsza obrona w głąb, istotny dług. Naprawić w najbliższej paczce. |
| **Low** | Drobna niezgodność, kosmetyka, utwardzenie „nice to have". |
| **Info** | Obserwacja / ryzyko do odnotowania, bez akcji teraz (np. konsekwencja świadomej decyzji). |

Ważność ocenia się **w kontekście projektu** (z fazy 0), nie abstrakcyjnie — szablon wymaga zapisania tego kontekstu na początku raportu.

### 6.5 Szablon raportu

1. Podsumowanie dla decydenta (5–10 zdań, liczby per ważność, werdykt „gotowe na następny etap: tak / tak, po paczce X / nie").
2. Kontekst i założenia (nie-cele, model zagrożeń lite, zakres, commit SHA, data, model/recenzent).
3. Mapa systemu (z fazy 1).
4. Metody i narzędzia (co uruchomiono, z wersjami).
5. Znaleziska — wg obszarów.
6. Tabela zbiorcza (ID, tytuł, ważność, pochodzenie, koszt, paczka).
7. Paczki naprawcze i kolejność.
8. Obszary sprawdzone bez znalezisk (z jednym zdaniem: co sprawdzono) — żeby „brak uwag" był weryfikowalny.
9. Porównanie / statystyka pochodzenia (nowe vs znane).
10. Retrospektywa szablonu.

## 7. Review Teamable — jak zostanie przeprowadzone

- **Zakres kodu:** `frontend/`, `backend/` (w tym migracje, skrypty), `docker-compose.yml`, `backend/docker-compose.yml`, Dockerfile'e, `nginx.conf`, `.github/workflows/`, konfiguracje lint/husky/commitlint, `README.md`, `requirements.md`, specy i plany Etapów 1–4.
- **Zakres specyfikacji (obszar N):** specy i plany Etapów 5 i 6 — skrótowo: luki, sprzeczności z kodem po Etapach 1–4, brakujące decyzje.
- **Metody:**
  - statyczna lektura kodu (cały kod — jest mały),
  - narzędzia jednorazowe: `npm audit`, `npm outdated`, Trivy (obrazy), Lighthouse i axe (przez Playwright/`npx`), ewentualnie analiza bundla — bez dodawania do repo,
  - dynamiczne: `docker compose up` + ręczne żądania `curl` (CORS preflight, nagłówki, upload z podmienionym MIME, duże body, zachowanie przy zatrzymanym Mongo, graceful shutdown),
  - uruchomienie istniejących testów i CI-owych komend lokalnie.
- **Baza review** (*moja decyzja*): branch `review/etap1-4` od `main`; pierwszy commit = niezacommitowana poprawka `requirements.md` (Etap 6 „(plan)") + ten dokument. SHA tego commita zapisany w raporcie; review dotyczy tego stanu.
- **Kolejność pracy:** szablon (commit) → faza 0–1 Teamable → obszary R, B, S, H, P, O, D, I, T, Q, U, X, N (commit raportu po każdych kilku obszarach) → triage → retrospektywa i poprawka szablonu (commit).
- **Wynik triage:** paczki naprawcze, np. „P1: security + HTTP przed Etapem 5", „P2: niezawodność", „P3: jakość/testy", „Spec-fix: poprawki specyfikacji Etapu 5/6", „Auth-prep: wejście do brainstormingu Etapu 4.5" (znaleziska z wpływem auth `rozwiąże`/`zmieni` + blokery wielu użytkowników). Triage proponuje też kolejność Etap 4.5 vs Etap 5. Każda paczka = osobny przyszły cykl brainstorm → plan.

## 8. Co zostaje dla wykonawcy

- Dokładne brzmienie pytań kontrolnych w `checklists.md` (zgodnie z 6.2).
- Dobór konkretnych komend narzędzi i ich flag.
- Podział znalezisk na paczki i nazwy paczek.
- Czy dany problem to jedno znalezisko, czy kilka (zasada: jedna przyczyna = jedno znalezisko).

## 9. Definicja ukończenia

- [ ] `docs/review/template/` — 3 pliki, bez odniesień do Teamable, z sekcją „jak zlecić agentowi".
- [ ] `docs/review/2026-11-22-teamable-review.md` — wszystkie sekcje z 6.5 wypełnione; każde znalezisko z dowodem i pochodzeniem; obszary bez znalezisk opisane.
- [ ] Każde znalezisko High/Critical zweryfikowane (reprodukcja lub dokładna ścieżka kodu).
- [ ] Paczki naprawcze zdefiniowane z kolejnością.
- [ ] Szablon poprawiony po retrospektywie.
- [ ] Kod aplikacji niezmieniony (diff tylko w `docs/`).
