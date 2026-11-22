# ADR-0013: Podpisy obrazów cosign — keyless (OIDC) i kluczem, weryfikacja przed każdym wdrożeniem

- **Status:** Proponowany
- **Retrospektywny:** nie
- **Data decyzji:** 2026-11-22 (źródło: rozmowa przy rewizji [specu Etapu 5](../superpowers/specs/2026-06-17-etap5-wdrozenia-design.md))
- **Data spisania:** 2026-11-22
- **Zastępuje / Zastąpiony przez:** —

## Kontekst

Etap 5 promuje obrazy z GHCR przez trzy środowiska. Każdy, kto ma prawo zapisu do paczek, może podmienić obraz pod etykietą, a sam digest mówi, *co* uruchamiamy, ale nie *kto* to zbudował. Projekt nie ma chmury, więc OIDC z GitHub Actions nie ma tu zastosowania w roli logowania do chmury; ma je w podpisach Sigstore. Użytkownik chce poznać oba sposoby podpisu: keyless i kluczem.

## Decyzja

Job `docker` w `ci.yml` podpisuje każdy obraz wypchnięty z `main` po digeście dwa razy: **keyless** (token OIDC GitHub Actions → certyfikat Sigstore, `id-token: write`) i **kluczem** (para kluczy cosign; prywatny i hasło w sekretach repo `COSIGN_PRIVATE_KEY`/`COSIGN_PASSWORD`, publiczny `cosign.pub` w repo). `deploy.yml` przed uruchomieniem weryfikuje oba podpisy dla digestu: kluczem publicznym oraz tożsamością workflow (`…/.github/workflows/ci.yml@refs/heads/main`, wystawca `https://token.actions.githubusercontent.com`). Brak któregokolwiek = brak wdrożenia.

## Rozważane opcje

- **Tylko keyless** — rekomendacja asystenta (brak klucza do przechowywania i rotacji); użytkownik wybrał oba warianty, żeby poznać różnicę w praktyce.
- **Tylko kluczem** — odrzucone jako jedyny wariant: OIDC nie miałoby zastosowania.

## Konsekwencje

**Pozytywne**

- Wdrożenie przyjmuje tylko obraz zbudowany przez `ci.yml` z `main` w tym repo; obcy lub ręcznie wypchnięty obraz zatrzymuje się na weryfikacji.
- Dwa modele zaufania obok siebie: tożsamość workflow (bez sekretu) i posiadanie klucza (sekret do chronienia).

**Negatywne / koszty**

- Klucz prywatny to sekret do rotacji; wyciek pozwala podpisać dowolny obraz, a weryfikacja kluczem przestaje cokolwiek znaczyć (keyless nadal chroni).
- Tożsamość keyless zależy od ścieżki i gałęzi workflow: zmiana nazwy `ci.yml` lub gałęzi domyślnej wymaga zmiany weryfikacji w `deploy.yml`.
- Podpis keyless trafia do publicznego rejestru przejrzystości Sigstore (Rekor): nazwa repo i workflow są jawne [wniosek: repo i tak jest publiczne].

**Niewiadome**

- Flagi i format podpisów w aktualnym cosign (v3) oraz zapis dwóch podpisów na jednym digeście — do potwierdzenia w dokumentacji przy pisaniu planu (Context7 nie zwrócił dokumentacji 2026-11-22).

## Dowody

- `.github/workflows/ci.yml` – job `docker` buduje i wypycha obrazy tylko z `main` (`docker/build-push-action`, output `digest`).
- [Spec Etapu 5](../superpowers/specs/2026-06-17-etap5-wdrozenia-design.md) – sekcje 4 i 5 (sekrety `COSIGN_*`, weryfikacja w `deploy.yml`).
