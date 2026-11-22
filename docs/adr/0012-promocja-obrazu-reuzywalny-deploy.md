# ADR-0012: Promocja obrazu w `ci.yml` przez reużywalny `deploy.yml` z wymuszoną kolejnością środowisk

- **Status:** Proponowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: rewizja [specu Etapu 5](../superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) i review architektoniczne)
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** — (zmienia decyzję 31 z `requirements.md` 8.1: osobny `cd.yml` na `workflow_run`)

## Kontekst

Etap 5 promuje ten sam obraz z GHCR przez dev → staging → production. Obraz wypycha job `docker` w `ci.yml`, tylko z `main`. Pierwsza wersja specu uruchamiała osobny `cd.yml` na `push` do `main`, więc CD mógł ruszyć przed wypchnięciem obrazu. Plan zamienił to na `workflow_run`, który wymaga wyciągania SHA z `workflow_run.head_sha`, a ścieżki tagu `v*` nie wiąże z wynikiem CI. W żadnym wariancie produkcja nie sprawdzała, czy staging przyjął ten commit.

## Decyzja

Joby `deploy-dev` → `deploy-staging` (`main`) oraz `check-staging` → `deploy-production` → `release` (tag `v*`) są w `ci.yml` i zależą od joba `docker` (`needs`). Kroki wdrożenia są raz, w `deploy.yml` (`on: workflow_call`, wejście `environment`, `concurrency` per środowisko). Job wywoływanego workflow ustawia `environment:` i dostaje sekrety przez `secrets: inherit`. `check-staging` wpuszcza produkcję tylko wtedy, gdy najnowszy deployment staging dla tego SHA ma status `success` (Deployments API). Deploy uruchamia obraz po digeście rozwiązanym z `:<sha>`, a na tagu obraz dostaje etykietę `vX.Y.Z` bez rebuildu.

## Rozważane opcje

- **Osobny `cd.yml` na `workflow_run`** — odrzucone: SHA z `workflow_run.head_sha`, ścieżka tagu bez związku z CI. Brak testu wdrożenia na PR dotyczy obu opcji, więc nie przesądza.
- **Kroki wklejone w trzech jobach `ci.yml`** — odrzucone: ~15 linii powtórzonych trzy razy rozjedzie się przy pierwszej zmianie [wniosek].

## Konsekwencje

**Pozytywne**

- `needs: docker` gwarantuje, że obraz o `github.sha` jest w GHCR przed wdrożeniem.
- Kolejność dev → staging → production jest wymuszona: produkcja bez zielonego staging dla tego SHA nie dostaje nawet prośby o zatwierdzenie.
- Deploy po digeście: nadpisana etykieta `:<sha>` (np. „Re-run" przebiegu main) nie zmieni tego, co uruchamia już rozpoczęte wdrożenie; digest widać w podsumowaniu joba.
- Jedna definicja wdrożenia dla trzech środowisk; wzorzec do reużycia w Etapie 6 (ZAP) [wniosek].

**Negatywne / koszty**

- `ci.yml` rośnie; granica CI/CD to joby, nie osobne pliki.
- `git push --follow-tags` (commit i tag naraz) kończy się czerwonym `check-staging`; trzeba poczekać na staging i ponowić przebieg tagu.
- Job wywołujący nie może mieć `environment:`; łatwo o pomyłkę przy przenoszeniu kroków.
- `secrets: inherit` przekazuje do `deploy.yml` także sekrety repo, których nie używa.

**Niewiadome**

- Czy deployment tworzony przez job z `environment:` dostaje status `success` po udanym jobie w formie, którą odczyta `check-staging` — do potwierdzenia w pierwszym przebiegu.
- Rozstrzygnięte 2026-11-22: `packages: read` na jobie wywołującym wystarcza do pobrania obrazu w wywoływanym workflow (token ma co najwyżej uprawnienia wywołującego).

## Dowody

- `.github/workflows/ci.yml` – job `docker`: `push: ${{ github.ref == 'refs/heads/main' }}`, etykiety `type=sha,prefix=` i `latest`.
- Dokumentacja GitHub Actions „Reuse workflows” – „To use an environment secret in a reusable workflow, set `environment` on the job in the reusable workflow. The job that calls the reusable workflow can't use the `environment` keyword.”
- `docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md` – wcześniejszy wariant z `workflow_run` i `github.event.workflow_run.head_sha`.
