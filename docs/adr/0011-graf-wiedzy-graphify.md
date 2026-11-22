# ADR-0011: Graf wiedzy Graphify commitowany do repo, aktualizowany w pre-commit, z wymuszonym odpytaniem przez agenta

- **Status:** Zaakceptowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: plan `docs/superpowers/plans/2026-11-22-graphify.md`); wdrożenie 2026-11-22
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Agent (Claude Code) przy każdym zadaniu od nowa przeszukuje repo grepem i czyta pliki. Graphify (CLI `graphify`, pakiet `graphifyy` 0.9.115) buduje graf kodu i dokumentacji. Właściciel chce, żeby graf był w repo, aktualizował się sam i żeby agent musiał go odpytać przed czytaniem plików. Repo używa husky, który ustawia `core.hooksPath=.husky/_`.

## Decyzja

Narzędzie i skill instalujemy globalnie, w user scope (`uv tool install graphifyy`, `graphify install`). W repo commitujemy tylko `graphify-out/graph.json`, z merge driverem `graphify` (`make graphify-setup`). Graf aktualizuje `graphify update .` (tylko kod, bez LLM) w `.husky/pre-commit`, więc trafia do tego samego commita co kod. Hooki PreToolUse z `graphify claude install` i `GRAPHIFY_HOOK_STRICT=1` w `.claude/settings.json` blokują pierwszy Read w sesji, dopóki agent nie odpyta grafu.

## Rozważane opcje

- `graphify hook install` (post-commit/checkout/merge): odrzucone. Hooki trafiają do `.git/hooks`, a husky ich nie uruchamia. Post-commit zostawia też graf jako niezacommitowaną zmianę.
- Pre-push: odrzucone, bo wymaga dodatkowego commita z grafem [wniosek].
- `graphify watch` w tle: odrzucone, bo trzeba pamiętać o procesie i nie commituje grafu [wniosek].

## Konsekwencje

**Pozytywne**

- Graf na `main` zawsze pasuje do kodu z tego samego commita.
- Commit bez `graphify` w PATH (CI, GUI, świeży klon) przechodzi, a hook pomija aktualizację.

**Negatywne / koszty**

- Zmiany w Markdown (specy, ADR-y) nie trafiają do grafu same. Trzeba uruchomić `/graphify --update` w Claude Code, który przepuszcza dokumenty przez model.
- Hook przebudowuje graf także przy commitach bez zmian w kodzie, a ponowny clustering zmienia nazwy części społeczności.
- Strict blokuje tylko pierwszy Read w sesji. Znacznik zapytania (`graphify-out/cache/last_query_stamp`, TTL 1800 s) jest wspólny dla projektu, więc zapytanie w dowolnej sesji zdejmuje blokadę na 30 minut. Grep i Bash dostają tylko podpowiedź.
- Hook Claude Code działa „fail open”: bez `graphify` w PATH niczego nie wymusza i nie zgłasza błędu.

**Niewiadome**

- Zachowanie merge drivera przy realnym konflikcie gałęzi: jeszcze niesprawdzone.

## Dowody

- `5d8ea3b` – `graph.json`, `.gitignore`/`.gitattributes`/`.graphifyignore`/`.prettierignore`, cel `graphify-setup`
- `a36ca42` – blok Graphify w `.husky/pre-commit`
- `2438ea9` – `.claude/settings.json` (hooki bez ścieżek absolutnych, `GRAPHIFY_HOOK_STRICT=1`), sekcja `## graphify` w `CLAUDE.md`
- test 2026-11-22 – commit próbny z `graphifyProbe.ts`: `graph.json` w tym samym commicie, `graphify explain` znalazł węzeł; commit cofnięty
- test 2026-11-22 – commit z PATH bez `graphify`: przeszedł; `GRAPHIFY_SKIP_HOOK=1`: hook pominięty
- test 2026-11-22 – `claude -p` z Read na `backend/src/app.ts`: odmowa „graphify strict mode: … Run `graphify query` … FIRST”; przy świeżym znaczniku zapytania tylko podpowiedź
- `graphify/cli.py` (`_run_hook_guard`, `_query_stamp_fresh`) w graphifyy 0.9.115 – warunki blokady
