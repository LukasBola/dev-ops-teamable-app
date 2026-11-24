---
name: etap5-cd-status
description: "Etap 5 (CD) parked since 2026-11-22: spec/ADRs/plan on unpushed branch; CI hardening PR #12 (2026-11-24) came first; open cosign-key decision"
metadata:
  node_type: memory
  type: project
  originSessionId: 8a4d32fc-8df5-4216-a8b6-e66a54af74d2
  modified: 2026-11-24T21:30:00.000Z
---

Etap 5 (CD) jest zaparkowany od 2026-11-22, po fazie dokumentów. Kod nie jest ruszony.

Stan dokumentów:
- Gałąź `docs/etap5-spec-rewrite` ma 4 commity (`a35b5d9`, `3a76043`, `2203853`, `1a75850`) i **nie jest wypchnięta**.
- Spec: `docs/superpowers/specs/2026-06-17-etap5-wdrozenia-design.md` (rewizja 2026-11-22).
- ADR-0012 (promocja) i ADR-0013 (cosign keyless + kluczem) mają status Proponowany.
- Plan: `docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md`, 8 zadań.
- `temp/` (prezentacja `temp/etap5-wdrozenia-prezentacja.html`) jest w `.gitignore` tylko na tej gałęzi. Na `main` i gałęziach od niego `temp/` pokazuje się jako nieśledzony i nie wolno go commitować.

2026-11-24 przed Etapem 5 zrobiliśmy hardening CI. Powód: audyt pod kątem kampanii wfx-loot, który nie wykazał kompromitacji. Szczegóły:
- PR #12 (`ci/harden-workflows`): `permissions: {}`, akcje przypięte do SHA, Dependabot (akcje + npm z karencją 7 dni), `persist-credentials: false`, `--ignore-scripts`, test `pinnedDeps.spec.ts`.
- Plan: `docs/superpowers/plans/2026-11-24-ci-hardening.md`.
- Dalsze kroki po merge'u (ruleset na `main`, Dependabot alerts, wymóg SHA dla akcji) są w planie.

Od czego zacząć przy wznowieniu Etapu 5. Trzy decyzje użytkownika, wciąż bez odpowiedzi:
1. **Klucz cosign** (nowe, z analizy 2026-11-24). Spec trzyma `COSIGN_*` w sekretach repo, a te są dostępne dla workflow z każdej gałęzi (dokładnie tak działał atak wfx). Opcje:
   - (a) osobny job `sign` na `main` z `environment: signing` (branch policy `main`, bez admin bypass), klucz w sekretach tego environment;
   - (b) tylko keyless.

   Weryfikacja keyless już przypina tożsamość `ci.yml@refs/heads/main`. ADR-0013 jest Proponowany, więc zmiana wchodzi do niego.
2. Czy wypchnąć `docs/etap5-spec-rewrite` i otworzyć PR przed kodem. Przy okazji: rebase na `main` po PR #12 i oznaczenie wiersza backlogu „Przypinanie akcji po SHA” w `requirements.md` 2.5 jako zrealizowanego.
3. Sposób wykonania planu: natywnie (rekomendacja) czy subagenci.

**Why:** użytkownik chce wrócić dokładnie w tym miejscu, a hardening zmienił założenia specu (sekrety w repo).
**How to apply:** na starcie sesji o Etapie 5 sprawdź, czy PR #12 jest zmergowany (`gh pr view 12`) i stan gałęzi `docs/etap5-spec-rewrite`, potem zadaj trzy pytania powyżej. Task 3 (ustawienia GitHub, sekrety) oraz merge/tag w Task 7–8 wymagają zgody użytkownika. Pracuj na zwykłych gałęziach ([[no-auto-worktrees]]).
