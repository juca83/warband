# Warband Arena

Autobattler de taverne entre amis, jouable dans le navigateur ou via le **Warband Launcher**.

## Structure du repo

| Dossier | Contenu |
|---|---|
| `Warband_Arena_vXX/` | Le jeu (ouvrir `index.html`). Le plus grand numéro = la version publiée. |
| `launcher/src/` | Code source du Warband Launcher (appli Electron). |
| `launcher/app.asar` | Le même code, tel qu'il est empaqueté dans l'appli. |
| `.github/workflows/publier-version.yml` | Publie automatiquement une version pour le launcher. |

## Comment le launcher trouve les versions

Le launcher lit la source du jeu (`juca83/warband`, réglable dans **⚙ Source du jeu**)
et télécharge la dernière **Release** GitHub de ce repo : un tag (`v77`…), des notes (affichées
comme « Nouveautés ») et un `.zip` du jeu. Le repo doit être **public**.

Les releases sont créées **automatiquement** : dès qu'un dossier `Warband_Arena_vXX` change sur `main`,
l'action « Publier une version pour le launcher » zippe le dossier le plus récent et publie la release.
Dans le launcher : **↻ Rechercher une mise à jour**, puis **JOUER**.

On peut aussi la relancer à la main : onglet **Actions** → « Publier une version pour le launcher » → **Run workflow**.

## Garder ses cartes d'une version à l'autre

Les cartes créées sont enregistrées dans le navigateur (ou dans le launcher), pas dans les fichiers du jeu.
Pour les transférer : **Admin mode → Export** (copie tout dans le presse-papiers) dans l'ancienne version,
puis **Admin mode → Import** (coller, puis Import) dans la nouvelle.
