#!/usr/bin/env bash
# ================================================================
#  Warband Launcher (Mac / Linux)
#  - telecharge / met a jour le jeu depuis TON GitHub (juca83/warband)
#  - puis ouvre la derniere version du jeu dans ton navigateur
#  Pour changer de source, modifie REPO ou BRANCH ci-dessous
#  (ou lance : WARBAND_REPO=... WARBAND_BRANCH=... ./Warband.command).
# ================================================================
REPO="${WARBAND_REPO:-https://github.com/juca83/warband.git}"
BRANCH="${WARBAND_BRANCH:-main}"
DEST="${WARBAND_DEST:-$HOME/.warband/warband}"

pause() { [ -t 0 ] && read -r -p "  Appuie sur Entree pour fermer..." _; }

echo
echo "  ===  WARBAND LAUNCHER  ==="
echo "  Source : $REPO  (branche $BRANCH)"
echo

if ! command -v git >/dev/null 2>&1; then
  echo "  [!] Git n'est pas installe."
  echo "      Mac : ouvre le Terminal et tape  xcode-select --install"
  echo "      Linux : installe le paquet 'git'."
  pause; exit 1
fi

if [ ! -d "$DEST/.git" ]; then
  echo "  Premier lancement : telechargement du jeu..."
  mkdir -p "$(dirname "$DEST")"
  if ! git clone --branch "$BRANCH" "$REPO" "$DEST"; then
    echo "  [!] Telechargement impossible (connexion internet ? compte GitHub ?)"
    pause; exit 1
  fi
else
  echo "  Recherche de mises a jour..."
  git -C "$DEST" remote set-url origin "$REPO"
  if git -C "$DEST" fetch origin "$BRANCH"; then
    git -C "$DEST" checkout -q -f -B "$BRANCH" "origin/$BRANCH"
    echo "  Jeu a jour."
  else
    echo "  [!] Pas de connexion a GitHub : lancement de la version deja installee."
  fi
fi

# dossier de jeu le plus recent : Warband_Arena_vXX avec le plus grand XX
GAME=""; best=-1
for d in "$DEST"/Warband_Arena_v*/; do
  [ -f "$d/index.html" ] || continue
  n=$(basename "$d" | tr -cd '0-9'); n=${n:-0}
  if [ "$n" -gt "$best" ]; then best=$n; GAME=${d%/}; fi
done
[ -z "$GAME" ] && [ -f "$DEST/index.html" ] && GAME="$DEST"
if [ -z "$GAME" ]; then echo "  [!] Aucun dossier de jeu trouve dans $DEST"; pause; exit 1; fi

echo "  Lancement : $GAME"
if [ -n "$WARBAND_NO_OPEN" ]; then echo "$GAME/index.html"
elif command -v open >/dev/null 2>&1; then open "$GAME/index.html"
else xdg-open "$GAME/index.html" >/dev/null 2>&1 &
fi
