# Aktualizacja grafu Graphify (tylko kod, bez LLM) w pre-commit. Nie w pre-merge-commit: git zapisuje drzewo merge commita przed hookiem, więc `git add` z hooka zostałby tylko w indeksie.
# Hooki husky, a nie `graphify hook install`: husky ustawia core.hooksPath, więc hooki z .git/hooks się nie uruchamiają.
# Bez zmian staged poza grafem — nic do zrobienia.
[ -n "$(git diff --cached --name-only -- . ':!graphify-out/graph.json')" ] || exit 0
if [ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] || ! command -v graphify >/dev/null 2>&1; then
  echo "graphify: pominięto aktualizację grafu (GRAPHIFY_SKIP_HOOK=1 albo brak graphify w PATH)" >&2
  exit 0
fi
# shortcut: graf budowany z drzewa roboczego, nie z indeksu — przy niezacommitowanych plikach tylko ostrzegamy.
if [ -n "$(git status --porcelain --untracked-files=normal -- backend frontend | grep -v '^[MADRC] ')" ]; then
  echo "graphify: uwaga — niezacommitowane/nieśledzone pliki w backend/ lub frontend/ trafią do grafu" >&2
fi
PYTHONHASHSEED=0 graphify update . || exit 1
git add graphify-out/graph.json
