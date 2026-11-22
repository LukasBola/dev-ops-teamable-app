# Projekt UI „Identyfikator”

Wygląd ekranu logowania i profilu Teamable po Etapie 4.5. Decyzje: [ADR-0008](../adr/0008-ui-identyfikator-tokeny-fonty.md) (projekt, tokeny, fonty) i [ADR-0010](../adr/0010-przekazanie-projektu-ui-tokeny-dtcg.md) (format tej paczki).

## Pomysł

Teamable to profil członka zespołu, więc głównym obiektem jest **identyfikator na smyczy**, taki jak ten z recepcji pierwszego dnia w pracy. Logowanie to pusty identyfikator z formularzem. Po zalogowaniu ten sam identyfikator obraca się i pokazuje profil. Wylogowanie obraca go z powrotem i czyści dane z widoku.

- **Jeden akcent:** żółta smycz i pasek profilu. Reszta to granat na chłodnym tle.
- **Jedna animacja:** lekkie wychylenie identyfikatora przy wejściu i obrót przy logowaniu/wylogowaniu. Przy `prefers-reduced-motion` stany zmieniają się bez animacji.
- **Jasny i ciemny motyw** z tych samych tokenów.

## Zawartość

| Plik | Co to jest |
|---|---|
| [`tokens.json`](tokens.json) | Kolory (jasne i ciemne), fonty, typografia, promienie, rozmiary, odstępy, cień, ruch — format W3C Design Tokens (DTCG), wartości wzięte z kodu |
| [`teamable-identyfikator.html`](teamable-identyfikator.html) | Interaktywna makieta zsynchronizowana z aplikacją (stany: logowanie, błąd, wysyłanie, profil, edycja). [Wersja opublikowana](https://claude.ai/artifact/HPG7NW1dbR8C46rSJsFNx5) |
| [`screens/`](screens/) | Zrzuty działającej aplikacji, 2× rozdzielczość |

## Kolory

| Token | Jasny | Ciemny | Rola |
|---|---|---|---|
| `wall` | `#e4e8f1` | `#121831` | tło strony (ściana biura) |
| `badge` | `#ffffff` | `#1d2443` | identyfikator, karty |
| `ink` | `#18204a` | `#e8ecf8` | tekst, przycisk główny |
| `ink-soft` | `#5a6386` | `#a3abcb` | tekst drugorzędny |
| `lanyard` | `#ffc53d` | `#ffcc4d` | smycz i pasek — jedyny akcent |
| `lanyard-ink` | `#3b2a00` | `#2e2100` | tekst na żółtym pasku |
| `line` | `#d3d9e8` | `#333c63` | ramki pól i kart |
| `field` | `#f3f5fa` | `#262e52` | tło pól, awatar bez zdjęcia |
| `error` / `error-bg` | `#b3261e` / `#fdecea` | `#ff9b8f` / `#3a1d24` | komunikaty błędów |
| `focus` | `#2d4fd6` | `#9db0ff` | obrys fokusu klawiatury (3 px) |

Źródło prawdy to `frontend/src/assets/main.css`. Przy zmianie koloru zaktualizuj też `tokens.json` i tę tabelę.

## Fonty

- **Bricolage Grotesque** (zmienna) — imiona, nagłówki, nazwa marki. Grubość 800, lekko ściśnięte odstępy (`-0.025em`).
- **Atkinson Hyperlegible** — tekst i formularze; krój zaprojektowany z myślą o czytelności przy słabszym wzroku.

Oba na licencji SIL Open Font License, darmowe w Google Fonts. W aplikacji serwowane lokalnie z paczek `@fontsource` (z polskimi znakami, `latin-ext`).

## Stany ekranów

| Stan | Jasny 1280 | Jasny 375 | Ciemny 1280 | Ciemny 375 |
|---|---|---|---|---|
| Logowanie | [png](screens/logowanie-jasny-1280.png) | [png](screens/logowanie-jasny-375.png) | [png](screens/logowanie-ciemny-1280.png) | [png](screens/logowanie-ciemny-375.png) |
| Wysyłanie („Logowanie…”) | [png](screens/wysylanie-jasny-1280.png) | [png](screens/wysylanie-jasny-375.png) | [png](screens/wysylanie-ciemny-1280.png) | [png](screens/wysylanie-ciemny-375.png) |
| Błąd logowania | [png](screens/blad-jasny-1280.png) | [png](screens/blad-jasny-375.png) | [png](screens/blad-ciemny-1280.png) | [png](screens/blad-ciemny-375.png) |
| Profil | [png](screens/profil-jasny-1280.png) | [png](screens/profil-jasny-375.png) | [png](screens/profil-ciemny-1280.png) | [png](screens/profil-ciemny-375.png) |
| Edycja profilu | [png](screens/edycja-jasny-1280.png) | [png](screens/edycja-jasny-375.png) | [png](screens/edycja-ciemny-1280.png) | [png](screens/edycja-ciemny-375.png) |

Przycisk wyboru pliku w edycji („Choose File”) to natywny element przeglądarki: w zrzutach jest po angielsku, bo tak działała przeglądarka testowa; w polskiej przeglądarce ma polski tekst.

## Zasady UX (z przeglądu `ui-ux-pro-max` i `web-design-guidelines`)

- Pola mają widoczne etykiety; `autocomplete="username"` / `current-password`, wklejanie dozwolone (menedżery haseł działają).
- Przycisk „Pokaż / Ukryj” przy haśle, z nazwą dla czytnika ekranu i stanem wciśnięcia.
- Błąd logowania zostaje widoczny do kolejnej próby, w `role="alert"`; zawsze „Niepoprawny e-mail lub hasło” (bez zdradzania, czy konto istnieje). Po błędzie e-mail zostaje, hasło znika i dostaje fokus.
- „Zaloguj” jest zawsze aktywny; blokuje się tylko na czas wysyłania, ze wskaźnikiem i tekstem „Logowanie…”. Puste pola zatrzymuje przeglądarka.
- Cele dotyku ≥ 44 px (pola 48 px, „Zaloguj” 52 px), wyraźny fokus klawiatury.
- Po zalogowaniu fokus na imieniu, po wylogowaniu na nagłówku formularza i komunikat „Wylogowano.” w `role="status"`.
- Rejestracji nie ma, więc zamiast „Załóż konto” jest „Poproś właściciela zespołu o dostęp.”

## Import do Figmy

Natywnego pliku `.fig` nie ma (ADR-0010). Dwa kroki z wtyczkami Figmy:

**1. Tokeny → zmienne (wtyczka Tokens Studio for Figma)**

1. Figma → *Plugins* → *Tokens Studio for Figma* → otwórz w pliku projektu.
2. *Settings* → format tokenów **W3C DTCG**.
3. *Tools* → *Load from file/folder* (albo wklej zawartość `tokens.json` w edytorze JSON) → `docs/design/tokens.json`.
4. Grupy `color.light` i `color.dark` ustaw jako dwa zestawy (motywy), resztę jako zestaw wspólny.
5. *Styles & Variables* → *Export to Figma* → zmienne kolorów, typografii i wymiarów pojawią się w pliku.

**2. Makieta → warstwy (wtyczka html.to.design)**

1. Figma → *Plugins* → *html.to.design*.
2. Wybierz import z pliku `docs/design/teamable-identyfikator.html` albo z linku do [opublikowanej makiety](https://claude.ai/artifact/HPG7NW1dbR8C46rSJsFNx5) (link wymaga udostępnienia; prywatny artefakt otworzy tylko właściciel).
3. Ustaw szerokość 1280 i 375 px, oba motywy (przełącznik w makiecie zmienia tylko stan; motyw — przez ustawienie systemu lub opcję wtyczki).
4. Animacja obrotu i smycz (pseudo-elementy CSS) mogą zaimportować się jako płaskie kształty — wtedy wzorem są zrzuty z `screens/`.

## Aktualizacja paczki

Po zmianie wyglądu: tokeny z `main.css` → `tokens.json`, makieta, zrzuty (Playwright na zbudowanej aplikacji z podstawionym API; stany i nazwy jak w tabeli wyżej) i ta strona.
