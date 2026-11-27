# ADR-0013: Podpisy obrazów cosign — keyless (OIDC) i kluczem ze środowiska `signing`, weryfikacja przed każdym wdrożeniem

- **Status:** Proponowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: rozmowa przy rewizji [specu Etapu 5](../superpowers/specs/2026-06-17-etap5-wdrozenia-design.md))
- **Data spisania:** 2026-11-22; zmiana 2026-11-27: klucz przeniesiony z sekretów repo do środowiska `signing` (po audycie bezpieczeństwa CI z 2026-11-24)
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Etap 5 promuje obrazy z GHCR przez trzy środowiska. Każdy, kto ma prawo zapisu do paczek, może podmienić obraz pod etykietą, a sam digest mówi, *co* uruchamiamy, ale nie *kto* to zbudował. Projekt nie ma chmury, więc OIDC z GitHub Actions nie ma tu zastosowania w roli logowania do chmury; ma je w podpisach Sigstore. Użytkownik chce poznać oba sposoby podpisu: keyless i kluczem.

Audyt CI z 2026-11-24 (kampania wfx-loot) pokazał, że sekrety repozytorium są dostępne dla workflow uruchomionego z dowolnej gałęzi: wystarczy wypchnąć gałąź ze zmienionym `ci.yml`, który wypisze sekret albo podpisze nim cokolwiek. Klucz cosign w sekretach repo dawałby to samo.

## Decyzja

Osobny job `sign` w `ci.yml` (`needs: docker`, tylko `main`) podpisuje każdy obraz wypchnięty z `main` po digeście dwa razy: **keyless** (token OIDC GitHub Actions → certyfikat Sigstore, `id-token: write`) i **kluczem** (para kluczy cosign, publiczny `cosign.pub` w repo). Prywatny klucz i hasło (`COSIGN_PRIVATE_KEY`/`COSIGN_PASSWORD`) są sekretami środowiska `signing` z deployment branch policy `main` i bez obejścia przez admina; job `sign` ma `environment: signing`. Job `docker` nie dostaje ani `id-token: write`, ani sekretów. `deploy.yml` przed uruchomieniem weryfikuje oba podpisy dla digestu: kluczem publicznym oraz tożsamością workflow (`…/.github/workflows/ci.yml@refs/heads/main`, wystawca `https://token.actions.githubusercontent.com`). Brak któregokolwiek = brak wdrożenia.

## Rozważane opcje

- **Tylko keyless** — rekomendacja asystenta (brak klucza do przechowywania i rotacji); użytkownik wybrał oba warianty, żeby poznać różnicę w praktyce.
- **Tylko kluczem** — odrzucone jako jedyny wariant: OIDC nie miałoby zastosowania.
- **Klucz w sekretach repo, podpis w jobie `docker`** — pierwotna wersja tego ADR-a (2026-11-22). Odrzucona 2026-11-27: sekret repo czyta workflow z każdej gałęzi.
- **Po audycie tylko keyless** — rozważone 2026-11-27 (mniej ruchomych części); użytkownik wybrał środowisko `signing`, żeby zachować oba modele zaufania.

## Konsekwencje

**Pozytywne**

- Wdrożenie przyjmuje tylko obraz zbudowany przez `ci.yml` z `main` w tym repo; obcy lub ręcznie wypchnięty obraz zatrzymuje się na weryfikacji.
- Dwa modele zaufania obok siebie: tożsamość workflow (bez sekretu) i posiadanie klucza (sekret do chronienia).
- Klucz dostaje tylko job z `main`; gałąź ze zmienionym workflow dostaje odmowę środowiska po stronie GitHuba, a nie pusty sekret.

**Negatywne / koszty**

- Dodatkowy job i środowisko do założenia (Task 3 planu) przed merge'em joba `sign`.
- Kto może wypchnąć commit na `main`, ten może podpisać obraz; ochrona klucza zależy więc też od rulesetu na `main` (issue #26) [wniosek].
- Każdy przebieg joba `sign` tworzy wpis deploymentu środowiska `signing` w zakładce Deployments [wniosek].
- Klucz prywatny to sekret do rotacji; wyciek pozwala podpisać dowolny obraz, a weryfikacja kluczem przestaje cokolwiek znaczyć (keyless nadal chroni).
- Tożsamość keyless zależy od ścieżki i gałęzi workflow: zmiana nazwy `ci.yml` lub gałęzi domyślnej wymaga zmiany weryfikacji w `deploy.yml`.
- Podpis keyless trafia do publicznego rejestru przejrzystości Sigstore (Rekor): nazwa repo i workflow są jawne [wniosek: repo i tak jest publiczne].

**Niewiadome**

- Czy certyfikat keyless z joba ze `environment: signing` ma tę samą tożsamość (`job_workflow_ref` → `ci.yml@refs/heads/main`) — [wniosek] tak; potwierdzi pierwszy przebieg weryfikacji w `deploy.yml`.
- Czy GHCR przyjmuje podpisy cosign v3 zapisywane domyślnie jako artefakty OCI 1.1 (referrers) — do potwierdzenia w pierwszym przebiegu; awaryjnie `--registry-referrers-mode legacy`.
- Rozstrzygnięte 2026-11-22: flagi (`sign --yes`, `--key env://…` + `COSIGN_PASSWORD`, `verify --key`, `--certificate-identity`, `--certificate-oidc-issuer`) i dwa podpisy na jednym digeście — dokumentacja cosign v3.1.4 i przykład cosign-installer v4.1.3.

## Dowody

- `.github/workflows/ci.yml` – job `docker` buduje i wypycha obrazy tylko z `main` (`docker/build-push-action`, output `digest`).
- [Spec Etapu 5](../superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) – sekcje 4 i 5 (środowisko `signing`, job `sign`, weryfikacja w `deploy.yml`).
- Audyt CI 2026-11-24: [plan hardeningu](../superpowers/plans/2026-11-24-ci-hardening.md), PR #12; decyzja o kluczu: issue #40.
- `sigstore/cosign` @ v3.1.4: `doc/cosign_sign.md`, `doc/cosign_verify.md`, `CHANGELOG.md` (v3.0.0: nowy format bundle i podpisy jako artefakty OCI 1.1 domyślnie).
- `sigstore/cosign-installer` @ v4.1.3: README – przykład „Sign image with a key” i „Sign the images with GitHub OIDC Token” na tym samym digeście.
