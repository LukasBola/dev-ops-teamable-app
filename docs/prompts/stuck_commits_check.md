# Plan: wykrycie commitów, które utknęły po merge'u PR-a

Ten plan możesz wykonać sam albo podać agentowi (np. Claude Code) jako prompt: „Wykonaj poniższy plan w tym repozytorium i zakończ raportem z wynikami kroków 2 i 3”. Wszystkie kroki tylko czytają: niczego nie zmieniają ani lokalnie, ani na GitHubie.

## Cel

Sprawdzić w repozytoriach w pracy dwie rzeczy:

- czy jakieś commity utknęły na gałęzi PR-a, który był już zmergowany;
- czy na komputerze są lokalne commity, których nigdy nie wypchnięto.

Skąd się bierze problem: merge zamyka PR i GitHub zapamiętuje go w stanie z tej chwili. Gałąź dalej przyjmuje pushe, ale te commity nie trafiają do żadnego PR-a ani na `main`. `git push` nie wyświetla przy tym żadnego ostrzeżenia, a gałąź usunięta po merge'u zostaje po cichu utworzona od nowa.

## Wymagania

Potrzebny jest lokalny klon każdego sprawdzanego repo oraz `git` i `gh` zalogowany do tego GitHuba, na którym są repozytoria.

1. Sprawdź narzędzia: `git --version` oraz `gh --version`.
2. Sprawdź logowanie: `gh auth status`. Jeśli nie jesteś zalogowany:
    - github.com: `gh auth login`
    - GitHub Enterprise: `gh auth login --hostname github.twojafirma.pl` (podstaw adres firmowego GitHuba)
3. Wystarczy prawo odczytu do repo.
4. Jeśli firma używa GitLaba albo Bitbucketa, skrypt z kroku 1 nie zadziała. Idea jest ta sama (merge request zapamiętuje swój ostatni commit), ale polecenia są inne. Krok 3 działa wszędzie, bo używa samego gita.

## Krok 1: zapisz skrypt

Skopiuj skrypt do pliku `~/bin/stuck-commits.sh` (katalog utworzysz poleceniem `mkdir -p ~/bin`).

Dla każdego zmergowanego PR-a skrypt bierze z GitHuba commit, który był czubkiem PR-a w chwili merge'u, i porównuje go z obecnym czubkiem gałęzi. Działa przy każdym sposobie merge'u: merge commit, squash i rebase.

```bash
#!/usr/bin/env bash
# Commity wypchnięte na gałąź PR-a już po jego merge'u (nie trafiły na gałąź domyślną).
# Uruchom w katalogu repozytorium: bash stuck-commits.sh
# Wymaga: git, gh (zalogowany). Tylko odczyt: nic nie zmienia ani lokalnie, ani na GitHubie.
set -euo pipefail

git fetch -q --prune origin
default=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
open_heads=$(gh pr list --state open --limit 500 --json headRefOid --jq '.[].headRefOid')
found=0

while IFS=$'\t' read -r num branch merged_sha merged_at; do
  tip=$(git rev-parse -q --verify "refs/remotes/origin/$branch" || true)
  [ -z "$tip" ] && continue                      # gałąź usunięta: nic nie utknęło
  [ "$tip" = "$merged_sha" ] && continue         # gałąź stoi tam, gdzie była przy merge'u
  git merge-base --is-ancestor "$tip" "origin/$default" && continue   # wszystko już jest na gałęzi domyślnej

  found=1
  if git cat-file -e "$merged_sha^{commit}" 2>/dev/null && git merge-base --is-ancestor "$merged_sha" "$tip"; then
    echo "PR #$num  gałąź $branch  (merge: $merged_at)"
    git log --format='    %h  %ad  %an  %s' --date=short "$merged_sha..$tip"
  else
    echo "PR #$num  gałąź $branch: przepisana po merge'u (force-push?). Porównaj ręcznie: git log $merged_sha..origin/$branch"
  fi
  # Czy te commity są w innym, otwartym PR-ze?
  for h in $open_heads; do
    if git merge-base --is-ancestor "$tip" "$h" 2>/dev/null; then
      echo "    ↳ OK: zawarte w otwartym PR-ze (head ${h:0:7})"
      break
    fi
  done
done < <(gh pr list --state merged --limit 500 --json number,headRefName,headRefOid,mergedAt,isCrossRepository \
           --jq '.[] | select(.isCrossRepository | not) | [.number, .headRefName, .headRefOid, .mergedAt] | @tsv')

[ "$found" = 0 ] && echo "Brak commitów, które utknęły po merge'u (gałąź domyślna: $default)."
exit 0
```

Skrypt sprawdziłem na repo Teamable 2026-11-24. Znalazł dokładnie 4 commity wypchnięte na gałąź PR #12 po jego merge'u i oznaczył je jako zawarte w otwartym PR #22.

## Krok 2: uruchom skrypt

Jedno repo:

```bash
cd ~/praca/nazwa-repo
bash ~/bin/stuck-commits.sh
```

Wiele repo naraz, jeśli klony leżą w jednym katalogu:

```bash
for d in ~/praca/*/; do
  [ -d "$d/.git" ] || continue
  echo "=== $d"
  (cd "$d" && bash ~/bin/stuck-commits.sh)
done
```

`git fetch` w skrypcie aktualizuje tylko referencje `origin/*`. Nie rusza twoich gałęzi ani plików w katalogu roboczym.

## Krok 3: lokalne commity, których nigdy nie wypchnięto

Ten krok szuka innego rodzaju zgubionej pracy: commitów, które istnieją tylko na tym komputerze. Uruchom w każdym repo:

```bash
git fetch --prune origin

# 1. Commity na lokalnych gałęziach, których nie ma na żadnej gałęzi zdalnej
git log --branches --not --remotes --format='%h %ad %D | %s' --date=short

# 2. Każda lokalna gałąź: czy ma odpowiednik zdalny i ile commitów go wyprzedza
git for-each-ref --format='%(refname:short) → %(if)%(upstream)%(then)%(upstream:short) %(upstream:track)%(else)BRAK UPSTREAMU%(end)' refs/heads

# 3. Odłożone zmiany (stash), o których łatwo zapomnieć
git stash list
```

Wersja dla wielu repo naraz:

```bash
for d in ~/praca/*/; do
  [ -d "$d/.git" ] || continue
  echo "=== $d"
  (cd "$d" && git fetch -q --prune origin \
     && git log --branches --not --remotes --format='  %h %ad %D | %s' --date=short \
     && git stash list | sed 's/^/  stash: /')
done
```

Polecenia sprawdziłem na repo Teamable: wykryły 4 commity na gałęzi `docs/etap5-spec-rewrite`, która nigdy nie była wypchnięta.

## Krok 4: jak czytać wyniki

| Wynik | Co znaczy | Co zrobić |
|---|---|---|
| `Brak commitów, które utknęły po merge'u` | W tym repo nic nie utknęło | Nic |
| Lista commitów pod `PR #… gałąź …` i linia `↳ OK: zawarte w otwartym PR-ze` | Commity utknęły, ale są już w innym otwartym PR-ze | Dokończyć tamten PR |
| Lista commitów pod `PR #… gałąź …` bez linii `↳ OK` | Commity utknęły i nie ma ich w żadnym PR-ze ani na gałęzi domyślnej | Krok 5 |
| `przepisana po merge'u (force-push?)` | Ktoś nadpisał historię gałęzi po merge'u | Porównać ręcznie poleceniem podanym w komunikacie |
| Commity z `git log --branches --not --remotes` | Istnieją tylko na tym komputerze | Wypchnąć albo świadomie porzucić |
| `[ahead N]` przy gałęzi | N lokalnych commitów nie jest na gałęzi zdalnej | `git push`, a jeśli PR jest zmergowany, krok 5 |
| `BRAK UPSTREAMU` | Gałąź nigdy nie była wypchnięta | Sprawdzić, czy jest potrzebna |
| Wpisy `stash` | Odłożone, niezacommitowane zmiany | `git stash show -p stash@{0}`, potem zdecydować |

## Krok 5: co zrobić ze znalezionymi commitami

Kolejność, która nie grozi utratą pracy:

1. **Sprawdź, czy zmiana nie weszła inną drogą.** Ktoś mógł ją powtórzyć albo zrobić cherry-pick: `git log origin/main --oneline --grep "fragment opisu commita"`. Treść zmian zobaczysz poleceniem `git diff <czubek z chwili merge'u> origin/<gałąź>`.
2. **Commity są cudze?** Zapytaj autora, zanim cokolwiek z nimi zrobisz.
3. **Przenieś je na nową gałąź od aktualnego `main`.** Ten sposób działa przy każdym rodzaju merge'u:

    ```bash
    git switch -c rescue/pr-123 origin/main
    git cherry-pick <czubek z chwili merge'u>..origin/<stara-gałąź>
    ```

    Czubek z chwili merge'u to pierwszy SHA podany przez skrypt dla danego PR-a. Ręcznie: `gh pr view 123 --json headRefOid -q .headRefOid`.
4. **Otwórz nowy PR:** `git push -u origin rescue/pr-123`, potem `gh pr create`. W opisie podlinkuj stary PR.
5. **Starej gałęzi nie usuwaj,** dopóki nowy PR nie zostanie zmergowany.

## Zapobieganie i ograniczenia

Jak unikać problemu:

- **Przed pushem do starej gałęzi** sprawdź stan jej PR-a: `gh pr view --json state -q .state`. Jeśli wypisze `MERGED`, utwórz nową gałąź od `main`.
- **Włącz w repo „Automatically delete head branches”** (Settings → General). Gałąź znika po merge'u, więc spóźniony push stworzy ją od nowa, a git wypisze `* [new branch]`. To widoczny sygnał, że coś jest nie tak.
- **Jedna gałąź, jeden PR.** Po merge'u nie używaj tej gałęzi ponownie.

Ograniczenia metody:

- Skrypt nie wykryje commitów na gałęzi zdalnej, która **nigdy nie miała PR-a**. Krok 3 łapie tylko te, które istnieją lokalnie na tym komputerze.
- Skrypt sprawdza 500 ostatnio zmergowanych PR-ów. W dużym repo zwiększ `--limit`.
- Skrypt pomija PR-y z forków: ich gałąź nie istnieje w `origin`, a gałąź o tej samej nazwie w `origin` dawałaby fałszywe alarmy.
- Skrypt zakłada, że zdalne repo nazywa się `origin`. Inną nazwę sprawdzisz poleceniem `git remote -v`.
- Skrypt działa tylko z GitHubem (github.com i GitHub Enterprise).
