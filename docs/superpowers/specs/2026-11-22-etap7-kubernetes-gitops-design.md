# Etap 7 — Kubernetes + GitOps (Argo CD) — zalążek specu

> **Data:** 2026-11-22
> **Status:** zalążek — do brainstormingu (po wdrożeniu Etapów 5 i 6)
> **Źródło:** decyzja 58 i backlog w [`requirements.md`](../../../requirements.md) (2.3, 2.5, 8.1); rozmowa przy rewizji [specu Etapu 5](2026-06-17-etap5-wdrozenia-design.md)
> **Poprzednie etapy:** [Etap 5 — wdrożenia](2026-06-17-etap5-wdrozenia-design.md) · [Etap 6 — obserwowalność i jakość](2026-06-17-etap6-obserwowalnosc-jakosc-design.md)

To nie jest projekt do planowania. Zalążek zbiera to, co już ustalono, i pytania na brainstorming. Pełny spec powstanie, gdy Etapy 5 i 6 będą wdrożone, bo ich wynik (podpisy, deploy po digeście, metryki) jest wejściem tego etapu.

## Cel i dlaczego

Poznać **GitOps** w prawdziwej formie: repozytorium Git opisuje pożądany stan środowisk, a agent w klastrze Kubernetes (**Argo CD**) w pętli porównuje stan klastra z Gitem i sam go wyrównuje (model *pull*). W Etapie 5 wdrożenie *pcha* pipeline (`docker compose up` w jobie). Etap 7 pokazuje różnicę między tymi modelami na tej samej aplikacji.

GitOps jest osobnym etapem, bo jego definicją jest agent w klastrze. Imitacja bez klastra uczyłaby połowy idei (decyzja 58, wybór użytkownika 2026-11-22).

## Co już ustalono

| Temat | Ustalenie | Źródło |
|---|---|---|
| Klaster | Prawdziwy Kubernetes lokalnie i w CI przez `kind` | rozmowa 2026-11-22 |
| Agent GitOps | Argo CD | decyzja 58 |
| Promocja | Pull request zmieniający digest obrazu w manifestach danego środowiska | rozmowa 2026-11-22 |
| Rollback | `git revert` commita z promocją | rozmowa 2026-11-22 |
| Artefakt | Te same obrazy z GHCR, podpisane w Etapie 5 (cosign keyless + kluczem, [ADR-0013](../../adr/0013-podpisy-obrazow-cosign.md)) | Etap 5 |

## Pozycje z backlogu (`requirements.md` 2.5)

- **Atestacje obrazów** (provenance, SBOM) i ich weryfikacja przy wdrożeniu.
- **Rollback**: porównanie ponownego wdrożenia starego digestu (`workflow_dispatch`, model Etapu 5) z `git revert` w GitOps.
- **release-please**: automatyczny semver i PR wydania z Conventional Commits.

## Pytania na brainstorming

1. **Gdzie żyją manifesty:** katalog w tym repo (`deploy/`) czy osobne repo konfiguracyjne? Osobne repo to typowa praktyka GitOps (rozdzielenie kodu i stanu środowisk), katalog jest prostszy.
2. **Format manifestów:** Kustomize (overlay per środowisko) czy Helm (szablony i wartości)?
3. **Środowiska:** jeden klaster z przestrzeniami nazw `dev`/`staging`/`production` czy osobne klastry?
4. **Klaster w CI:** efemeryczny `kind` w jobie (jak Etap 5) czy tylko lokalnie, z CI walidującym manifesty?
5. **Kto otwiera PR promocji:** job po zielonym staging (bot) czy człowiek? Jak to łączy się z bramką staging i zatwierdzaniem z Etapu 5?
6. **MongoDB w klastrze:** StatefulSet z wolumenem czy zewnętrzna baza? Co z migracjami (Job/hook Argo CD zamiast `docker-entrypoint.sh`)?
7. **Sekrety w Gicie:** Sealed Secrets, SOPS czy External Secrets? GitOps wymaga, żeby stan był w Gicie, ale sekrety nie mogą być jawne.
8. **Weryfikacja podpisów w klastrze:** polityka dopuszczania obrazów (np. Kyverno albo Sigstore policy-controller) zamiast kroku `cosign verify` w jobie?
9. **Co zostaje z Etapu 5:** czy Compose i `deploy.yml` zostają obok (porównanie modeli), czy Etap 7 je zastępuje?
10. **Obserwowalność:** jak Prometheus i Grafana z Etapu 6 przenoszą się do klastra?

## Poza zakresem (wstępnie)

Chmura zarządzana (EKS/GKE/AKS), service mesh, autoskalowanie, wiele klastrów i regionów — do potwierdzenia na brainstormingu.
