# ADR-0012: Promocja obrazu w `ci.yml` przez reużywalny `deploy.yml` z wymuszoną kolejnością środowisk

- **Status:** Proponowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: rewizja [specu Etapu 5](../superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) i review architektoniczne)
- **Data spisania:** 2026-11-22; zmiana 2026-11-28 (review PR #54): promocja dokładnie tej pary digestów, która przeszła staging (manifest zamiast Deployments API), sekrety po nazwie
- **Zastępuje / Zastąpiony przez:** — (zmienia decyzję 31 z `requirements.md` 8.1: osobny `cd.yml` na `workflow_run`)

## Kontekst

Etap 5 promuje ten sam obraz z GHCR przez dev → staging → production. Obraz wypycha job `docker` w `ci.yml`, tylko z `main`. Pierwsza wersja specu uruchamiała osobny `cd.yml` na `push` do `main`, więc CD mógł ruszyć przed wypchnięciem obrazu. Plan zamienił to na `workflow_run`, który wymaga wyciągania SHA z `workflow_run.head_sha`, a ścieżki tagu `v*` nie wiąże z wynikiem CI. W żadnym wariancie produkcja nie sprawdzała, czy staging przyjął ten commit.

## Decyzja

Na `main`: `docker → sign → deploy-dev → deploy-staging`. Build wystawia dwa digesty; oba wdrożenia weryfikują i uruchamiają dokładnie tę parę. Po udanym smoke staging zapisuje artefakt `staging-<run_id>-<run_attempt>.json` zawierający pełny SHA commita oraz obie referencje `repozytorium@sha256:…`.

Na tagu `v*`: `e2e → check-staging → tag-release → deploy-production → release`. Bramka wybiera udany przebieg `ci.yml` dla `push` na `main` w tym repozytorium i dla pełnego SHA oznaczonego commita. Czyta manifest dokładnie z wybranej, udanej próby, sprawdza SHA, nazwy obu repozytoriów obrazów i format digestów. Brak zgodnego manifestu zatrzymuje wydanie. Re-tag i produkcja używają wyłącznie tej pary, także po oczekiwaniu na zatwierdzenie. Produkcja ponownie sprawdza oba podpisy z ADR-0013.

Wspólny `deploy.yml` dostaje środowisko i dwie referencje obrazów jako wejścia (`concurrency` per środowisko). Job ustawia `environment:`; caller przekazuje sekrety aplikacji po nazwie (bez tego sekret środowiska jest w wywołanym workflow pusty), nie `secrets: inherit`, a job jawnie sprawdza, że wymagany sekret nie jest pusty.

## Rozważane opcje

- **Osobny `cd.yml` na `workflow_run`** — odrzucone: SHA z `workflow_run.head_sha`, ścieżka tagu bez związku z CI. Brak testu wdrożenia na PR dotyczy obu opcji, więc nie przesądza.
- **Bramka po Deployments API (najnowszy deployment staging dla SHA = `success`), digest rozwiązywany z `:<sha>`** — pierwotna wersja tego ADR-a (2026-11-22). Odrzucona 2026-11-28 w review PR #54: „Re-run” joba `docker` przesuwa `:<sha>` na inny, też podpisany obraz, więc produkcja mogła dostać inną parę niż przetestowana na staging.
- **Kroki wklejone w trzech jobach `ci.yml`** — odrzucone: ~15 linii powtórzonych trzy razy rozjedzie się przy pierwszej zmianie [wniosek].

## Konsekwencje

**Pozytywne**

- `needs: [docker, …]` gwarantuje, że obraz jest w GHCR przed wdrożeniem, i daje dostęp do jego digestów (`needs` widzi tylko bezpośrednie zależności).
- Kolejność dev → staging → production jest wymuszona: produkcja bez manifestu udanego staging dla tego SHA nie dostaje nawet prośby o zatwierdzenie.
- Para digestów nie jest rozwiązywana z etykiety na żadnym etapie: nadpisana `:<sha>` (np. „Re-run” przebiegu main) nie zmienia ani wdrożenia, ani wydania; digest widać w podsumowaniu joba.
- Jedna definicja wdrożenia dla trzech środowisk; wzorzec do reużycia w Etapie 6 (ZAP) [wniosek].

**Negatywne / koszty**

- `ci.yml` rośnie; granica CI/CD to joby, nie osobne pliki.
- `git push --follow-tags` (commit i tag naraz) kończy się czerwonym `check-staging`; trzeba poczekać na staging i ponowić przebieg tagu.
- Job wywołujący nie może mieć `environment:`; łatwo o pomyłkę przy przenoszeniu kroków.
- Po wygaśnięciu artefaktu trzeba ponownie przeprowadzić staging. Nie odtwarzamy manifestu z obecnych etykiet GHCR.

**Niewiadome**

- Który manifest wybrać po „Re-run failed jobs”, gdy staging przeszedł we wcześniejszej próbie (nazwa artefaktu ma inny `run_attempt`) — do potwierdzenia w Task 6; brak manifestu kończy się bezpieczną porażką bramki.
- Rozstrzygnięte 2026-11-22: `packages: read` na jobie wywołującym wystarcza do pobrania obrazu w wywoływanym workflow (token ma co najwyżej uprawnienia wywołującego).

## Dowody

- `.github/workflows/ci.yml` – job `docker`: `push: ${{ github.ref == 'refs/heads/main' }}`, etykiety `type=sha,prefix=` i `latest`.
- Dokumentacja GitHub Actions „Reuse workflows” – „To use an environment secret in a reusable workflow, set `environment` on the job in the reusable workflow. The job that calls the reusable workflow can't use the `environment` keyword.”
- `docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md` – wcześniejszy wariant z `workflow_run` i `github.event.workflow_run.head_sha`.
- Dokumentacja GitHub Actions „Reuse workflows” – „The caller workflow must still pass the secret… You can pass a secret by name even if it only exists in the environment” oraz „If the caller workflow doesn't pass an environment secret, the secret resolves to an empty string”.
- Review PR #54 (2026-11-28) – scenariusz przesunięcia `:<sha7>` między staging a wydaniem.
