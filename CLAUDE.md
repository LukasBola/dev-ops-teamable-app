# Teamable — wskazówki dla Claude

Projekt edukacyjny do nauki DevOps: profil członka zespołu (Vue 3 + Express 5 + MongoDB), rozwijany etapami. Wymagania i tabela decyzji: `requirements.md`. Projekty i plany etapów: `docs/superpowers/specs/`, `docs/superpowers/plans/`. Decyzje architektoniczne: `docs/adr/`. Projekt UI: `docs/design/`. Dokumentację i komunikaty piszemy po polsku.

## Decyzje architektoniczne (ADR)

Zapisuj decyzję jako ADR, gdy jest **istotna i cenna** — spełnia co najmniej jeden warunek z `docs/adr/README.md` („Kiedy pisać ADR”):

- trudno ją odwrócić albo dotyka wielu miejsc (baza, auth, granica frontend/API, format danych, kontrakt);
- wybieramy między realnymi opcjami, a powód nie wynika z samego kodu;
- wprowadza ograniczenie, którego złamanie psuje coś po cichu (przypięta wersja, kolejność middleware, nazwy indeksów);
- zmienia albo zastępuje wcześniejszą decyzję.

Nie pisz ADR-a dla łatwo odwracalnego wyboru biblioteki, szczegółów widocznych w kodzie, poprawek błędów ani kroków procesu — to trafia do planu, opisu PR albo komentarza w kodzie.

Kiedy:

- **Spec / plan / brainstorming:** decyzja spełniająca warunki → ADR ze statusem **Proponowany** razem ze specem; spec linkuje ADR.
- **W trakcie wdrożenia:** gdy trzeba zdecydować inaczej niż w specu albo pojawia się nowe ograniczenie (np. konflikt wersji, zachowanie biblioteki odkryte w testach) → nowy ADR albo rozstrzygnięcie niewiadomej w istniejącym. Powiedz użytkownikowi jednym zdaniem, że decyzja trafi do ADR-a.
- **Koniec etapu:** ADR-y etapu → **Zaakceptowany**, w „Dowodach” SHA commitów; niewiadome rozstrzygnięte z datą.

Jak:

- Kopia `docs/adr/0000-template.md` (wzór z projektu helpdesk), kolejny numer, nazwa `NNNN-krotki-tytul-kebab-case.md`, maks. ~1 strona.
- Każde twierdzenie ma dowód (commit, plik, wynik polecenia) albo dopisek `[wniosek]`. Nie dopisuj opcji, których nikt nie rozważał.
- Zaakceptowanego ADR-a nie zmieniaj merytorycznie: zmiana decyzji = nowy ADR, stary dostaje „Zastąpiony przez”.
- Dopisz wiersz do tabeli w `docs/adr/README.md` i do `requirements.md` 8.1 (kolejny wolny numer decyzji — sprawdź też specy etapów, bo numery bywają zarezerwowane).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
