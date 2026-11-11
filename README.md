# Azur — logiciel de budget pour Windows et Mac

Azur est un logiciel de gestion de budget mensuel personnel : entrées, dépenses, semences (dîme, offrandes, dons), épargnes, plafonds, objectifs, statistiques et bilan du mois.

- **Comptes personnels** : chaque personne crée son compte avec son adresse Gmail ou son numéro de téléphone et un mot de passe. Personne ne voit les chiffres des autres.
- **Synchronisation** : les données sont enregistrées en ligne (Firebase) et gardées en copie sur chaque appareil pour fonctionner hors connexion.
- **Sécurité** : chaque compte ne voit que ses propres données. Mot de passe oublié : lien de réinitialisation envoyé sur Gmail.
- **Version web** : https://narcisseetsinyo-cmd.github.io/azur/

Le guide complet d'utilisation, avec la charte graphique et colorimétrique, se trouve dans [`docs/Azur-Guide-utilisation.pdf`](docs/Azur-Guide-utilisation.pdf).

## Télécharger le logiciel (Mac et Windows)

Les installateurs se téléchargent sur la page protégée par mot de passe :
**https://narcisseetsinyo-cmd.github.io/azur/telecharger/**

Ils y sont publiés **chiffrés** (AES-256) : sans le mot de passe de téléchargement, les fichiers sont illisibles, même pour quelqu'un qui les récupérerait directement. Les installateurs ne sont plus joints à la page Releases.

### Publier une nouvelle version du logiciel

1. Une seule fois : dans **Settings › Secrets and variables › Actions**, crée le secret `DOWNLOAD_PASSWORD` avec le mot de passe de téléchargement. Pour le changer, modifie ce secret puis relance l'étape 2.
2. Onglet **Actions › Fabriquer les installateurs › Run workflow**, coche **Mettre les installateurs en ligne**, puis **Run workflow**.
3. Une vingtaine de minutes plus tard, la page de téléchargement propose la nouvelle version, et les logiciels déjà installés la signalent dans **Paramètres › Mises à jour**.

## Installer

**Windows** : lance `Azur-Setup-<version>.exe`. Comme le logiciel n'est pas encore signé par un certificat payant, Windows peut afficher « Windows a protégé votre ordinateur ». Clique alors sur **Informations complémentaires**, puis sur **Exécuter quand même**.

**Mac** : ouvre le `.dmg` et glisse Azur dans **Applications**. Au premier lancement, macOS peut bloquer l'ouverture, car le logiciel n'est pas signé par Apple. Va dans **Réglages Système › Confidentialité et sécurité**, puis clique sur **Ouvrir quand même** en face d'Azur. Tu peux aussi faire un clic droit sur Azur, puis **Ouvrir**.

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
