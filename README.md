# Warband Arena

Autobattler de taverne (dans l'esprit des « battlegrounds ») jouable dans le navigateur.
Le jeu est dans `Warband_Arena_vXX/` : on ouvre simplement `index.html`.

## Lancer le jeu avec le launcher

Le launcher télécharge le jeu depuis **ce** repo (`juca83/warband`), le met à jour à chaque lancement,
puis ouvre la dernière version (`Warband_Arena_v` avec le plus grand numéro) dans ton navigateur.

### Windows
1. Installe **Git for Windows** : https://git-scm.com/download/win (options par défaut).
2. Sur GitHub, ouvre `launcher/Warband.bat` → bouton **Download raw file** (icône ⤓ en haut à droite du fichier).
3. Mets `Warband.bat` sur ton Bureau et double-clique dessus.
   Au premier lancement, une fenêtre GitHub peut s'ouvrir : connecte-toi (le repo est privé).

### Mac / Linux
1. Télécharge `launcher/Warband.command` de la même façon.
2. Dans un terminal : `chmod +x ~/Downloads/Warband.command`, puis double-clique dessus.

Le jeu est installé dans `%LOCALAPPDATA%\Warband\warband` (Windows) ou `~/.warband/warband` (Mac/Linux).
Pour suivre une autre branche ou un autre repo, modifie `REPO` / `BRANCH` en haut du launcher.

## Gros fichiers (plus de 25 Mo)

Le site GitHub refuse les fichiers de plus de 25 Mo en glisser-déposer. Deux solutions :
- **Releases** (pour un `.exe`, un `.zip`…) : page du repo → **Releases** → **Draft a new release** →
  glisse le fichier (jusqu'à 2 Go) → **Publish release**. On le télécharge ensuite depuis l'onglet Releases.
- **GitHub Desktop** (https://desktop.github.com) pour les fichiers du jeu jusqu'à 100 Mo.
