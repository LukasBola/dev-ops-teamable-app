# ADR-0008: Projekt UI „Identyfikator”, tokeny kolorów w `@theme` Tailwind 4 i fonty serwowane lokalnie

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: makieta zaakceptowana przez właściciela przed Taskiem 6); wdrożenie 2026-11-22 (`03d3cac`)
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** — (zawęża 5.2 `requirements.md`: „nowoczesny, ale stonowany”)

## Kontekst

Etap 4.5 dodaje ekran logowania i wylogowanie. Dotychczasowy wygląd to domyślna karta Tailwind (indygo), bez tokenów i trybu ciemnego. Spec podawał tylko szkic formularza „w stylu `ProfileForm`”. Przegląd skilla `ui-ux-pro-max` nie dał dopasowanego kierunku wizualnego (wzorce stron docelowych), za to dał reguły UX dla logowania.

## Decyzja

Motyw identyfikatora na smyczy: przód to logowanie, po zalogowaniu identyfikator obraca się i pokazuje profil (jedyna animacja, wyłączona przy `prefers-reduced-motion`). Kolory jako zmienne CSS z wersją ciemną, mapowane w `@theme inline` Tailwind 4 — komponenty nie mają surowych hexów. Fonty Bricolage Grotesque i Atkinson Hyperlegible z paczek `@fontsource`, serwowane przez aplikację (z `latin-ext`).

## Rozważane opcje

- Pozostawienie karty indygo i dopisanie formularza: odrzucone przez właściciela na rzecz wyrazistego projektu.
- Kierunek z bazy `ui-ux-pro-max` (fiolet, Baloo 2 / Comic Neue): odrzucony — dopasowany do strony docelowej i aplikacji dla dzieci.
- Google Fonts przez `<link>`: odrzucone — zapytania do zewnętrznego hosta i zależność od niego [wniosek].

## Konsekwencje

**Pozytywne**

- Jedno miejsce kolorów (jasny i ciemny motyw); wszystkie istniejące `data-test` zachowane.
- Reguły UX logowania (menedżery haseł, „Pokaż hasło”, trwały błąd w `role="alert"`, fokus po błędzie) pokryte testami.

**Negatywne / koszty**

- Dwie nowe zależności frontendu (fonty) i 119 kB plików `woff2` w buildzie (przeglądarka pobiera tylko potrzebne zakresy znaków).
- Rozszerzony zakres Taska 6: także `ProfileCard` i `ProfileForm`.

**Niewiadome**

- Brak.

## Dowody

- `21ab488` – `docs/design/teamable-identyfikator.html` (makieta), plan Taska 6 z akceptacją
- `03d3cac` – `frontend/src/assets/main.css` (`@theme inline`, tryb ciemny), komponenty, `@fontsource`; przegląd `web-design-guidelines` i zrzuty 1280/375 px jasny/ciemny opisane w planie, Task 6
- `npm --prefix frontend run build-only` (2026-11-22) – 7 plików `woff2`, razem 119 kB
- `610b1f5` – `LoginForm` bez `novalidate` (puste pola blokuje przeglądarka, AUI-N3)
