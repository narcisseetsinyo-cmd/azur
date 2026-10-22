# Azur — logiciel de budget pour Windows et Mac

Azur est un logiciel de gestion de budget mensuel personnel : entrées, dépenses, semences (dîme, offrandes, dons), épargnes, plafonds, objectifs, statistiques et bilan du mois.

- **Comptes personnels** : chaque personne crée son compte avec son adresse Gmail ou son numéro de téléphone et un mot de passe. Personne ne voit les chiffres des autres.
- **Base de données locale** : tout est enregistré dans un fichier SQLite sur l'ordinateur. Rien n'est envoyé sur Internet, et le logiciel fonctionne hors connexion.
- **Sécurité** : les mots de passe ne sont jamais enregistrés en clair (ils sont chiffrés avec scrypt). Après 5 essais ratés, le compte est bloqué quelques instants.
- **Mot de passe oublié** : à la création du compte, Azur affiche un code de secours à noter. Il permet de choisir un nouveau mot de passe.

Le guide complet d'utilisation, avec la charte graphique et colorimétrique, se trouve dans [`docs/Azur-Guide-utilisation.pdf`](docs/Azur-Guide-utilisation.pdf).

## Obtenir les installateurs avec GitHub

GitHub fabrique automatiquement les deux installateurs, sur de vrais ordinateurs Windows et Mac.

1. Sur github.com, crée un nouveau dépôt nommé `azur` (bouton **New**).
2. Envoie-y tous les fichiers de ce dossier : **Add file › Upload files**, puis glisse le contenu du dossier, y compris le dossier `.github`.
3. Ouvre l'onglet **Actions**, choisis **Fabriquer les installateurs**, puis clique sur **Run workflow**.
4. Au bout d'une dizaine de minutes, ouvre l'exécution terminée. En bas de la page, télécharge :
   - **Azur-Windows** : contient `Azur-Setup-1.0.0.exe`
   - **Azur-Mac** : contient `Azur-1.0.0-arm64.dmg` (Mac M1, M2, M3, M4) et `Azur-1.0.0-x64.dmg` (Mac Intel)

Pour publier une version officielle avec une page de téléchargement, crée un tag qui commence par `v` (par exemple `v1.0.0`). Les installateurs seront alors joints à la page **Releases**.

## Installer

**Windows** : lance `Azur-Setup-1.0.0.exe`. Comme le logiciel n'est pas encore signé par un certificat payant, Windows peut afficher « Windows a protégé votre ordinateur ». Clique alors sur **Informations complémentaires**, puis sur **Exécuter quand même**.

**Mac** : ouvre le `.dmg` et glisse Azur dans **Applications**. Au premier lancement, macOS peut bloquer l'ouverture, car le logiciel n'est pas signé par Apple. Va dans **Réglages Système › Confidentialité et sécurité**, puis clique sur **Ouvrir quand même** en face d'Azur. Tu peux aussi faire un clic droit sur Azur, puis **Ouvrir**.

## Où sont les données ?

| Système | Fichier de la base |
| --- | --- |
| Windows | `%APPDATA%\Azur\azur.sqlite` |
| Mac | `~/Library/Application Support/Azur/azur.sqlite` |

Le bouton **Paramètres › Stockage › Afficher le fichier de la base** ouvre directement ce dossier. Pour une sauvegarde, utilise **Paramètres › Données › Sauvegarder**, et garde le fichier sur une clé USB ou un autre disque. Désinstaller Azur ne supprime pas la base.

## Pour les développeurs

```bash
npm install          # installe et prépare la base pour Electron
npm start            # lance Azur
npm test             # teste la base et les comptes (après « npm rebuild better-sqlite3 »)
npm run dist:win     # fabrique l'installateur Windows (sur Windows)
npm run dist:mac     # fabrique les .dmg (sur Mac)
```

Organisation :

- `src/main.js` : fenêtre, menus, et le seul accès à la base. L'interface ne peut lire que les données du compte connecté.
- `src/db.js` : base SQLite (comptes, réglages, opérations) et vérification des mots de passe.
- `src/preload.js` : pont sécurisé entre l'interface et la base.
- `src/renderer/` : interface (écran de connexion, application Azur, polices et icônes intégrées).
- `test/` : tests de la base et banc d'essai de l'interface.

Polices : Outfit et Material Symbols (licences libres), Clash Display (Fontshare Free License, voir `src/renderer/fonts`).

## Mises à jour

Depuis la version 1.2.0, Azur se met à jour sans rien réinstaller :

- **Interface (Mac et Windows)** : au démarrage puis toutes les 6 heures, Azur vérifie la version web. Les fichiers modifiés sont téléchargés, vérifiés, puis appliqués au redémarrage. Si une nouvelle interface ne démarre pas, Azur revient tout seul à la précédente.
- **Logiciel complet (Windows)** : la nouvelle version se télécharge en arrière-plan et s'installe au redémarrage.
- **Logiciel complet (Mac)** : sans signature Apple payante, macOS n'autorise pas l'installation automatique. Azur signale la nouvelle version dans Paramètres › Mises à jour, avec un lien vers la page de téléchargement.

Pour publier une mise à jour de l'interface : augmenter `azurUi` dans `package.json`, puis pousser sur `main`. La version web et tous les logiciels installés la reçoivent. Si la mise à jour demande aussi un nouveau logiciel, augmenter `version` et `azurMinShell`, puis lancer « Fabriquer les installateurs » avec « Publier une version officielle ».
