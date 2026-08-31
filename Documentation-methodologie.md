# Spécifications Méthodologiques : Architecture d'un Pipeline CI/CD Canonisé & Mutualisé

## 1. Vision et Principes Fondateurs

L'architecture retenue repose sur le concept de **Pipeline Canonisé**. L'objectif principal est de fournir un workflow d'Intégration et de Déploiement Continus (CI/CD) **unique, générique, réutilisable et mutualisé** pour l'ensemble des microservices de l'organisation, indépendamment de leurs stacks technologiques (Node.js, Python, Java/Spring Boot, Rust).

### Principes Clés :
1. **Découplage Strict (Orchestration vs Exécution)** :
   - Le workflow CI/CD (`.github/workflows/main.yaml`) agit uniquement comme un **chef d'orchestre générique**. Il ne contient aucune commande spécifique à une technologie (pas de `npm test`, `cargo test` ou `mvn test` en dur dans les workflows).
   - La logique d'installation, de test et de build est **embarquée au cœur du code source de chaque microservice** via une interface de scripts Shell standardisés.

2. **Portabilité et Parité Dev/CI** :
   - Tout développeur peut exécuter localement `./scripts/test-unit.sh` ou `./scripts/test-sast.sh` et obtenir exactement le même comportement et le même résultat que dans l'environnement de CI.

3. **Images Docker d'Exécution Personnalisées & Centralisées** :
   - L'environnement d'exécution de chaque job du workflow est entièrement conteneurisé. 
   - Le pipeline peut utiliser des **images Docker sur-mesure (custom images)** créées et maintenues pour l'organisation (déclarées ou référencées via des variables de distribution comme `app.image.distrib`).
   - Ces images personnalisées embarquent au préalable **tous les outils, SDKs, compilateurs, linters et binaires de test nécessaires** (ex: Node.js, Python, Rust, Semgrep, Trivy, CLI de build).
   - **Bénéfices** : Suppression du temps de téléchargement et d'installation des outils pendant le workflow, reproductibilité parfaite des environnements, contrôle strict des versions d'outillage DevSecOps.

4. **Tolérance Zéro & Principe Fail-Fast** :
   - Toute étape (tests unitaires, SAST, build) qui échoue renvoie un code de sortie Shell non-nul (`!= 0`), entraînant l'arrêt immédiat du runner et du pipeline.

---

## 2. Structure Standardisée des Projets Microservices

Chaque projet adoptant l'architecture canonisée doit respecter la structure minimale suivante :

```text
.
├── .github/
│   └── workflows/
│       └── main.yaml            # Workflow CI/CD canonisé et générique
├── scripts/                     # Points d'entrée Shell standardisés
│   ├── setup.sh                 # Installation des dépendances du projet
│   ├── test-unit.sh             # Exécution des tests unitaires
│   └── test-sast.sh             # Analyse statique de sécurité (SAST)
├── release.version              # Fichier contenant la version sémantique (ex: 1.0.0)
├── app.image.distrib            # Déclaration du type d'image/technologie (ex: node)
├── Dockerfile                   # Build conteneurisé du service
└── .semgrepignore               # Exclusion des répertoires non-applicatifs du SAST
```

---

## 3. Spécifications des Scripts Shell (`/scripts`)

Les scripts Shell situés dans le dossier `/scripts` constituent le contrat d'interface entre le runner CI/CD et le projet.

### 3.1. Directives de Sécurité et Fail-Fast (`set -euo pipefail`)

Chaque script Shell doit impérativement débuter par l'activation des options de contrôle strictes de Bash/POSIX :

```bash
set -euo pipefail
```

#### Explication détaillée des options :
- **`set -e` (Exit immediately)** : Le script s'interrompt immédiatement dès qu'une commande renvoie un code d'erreur (code de sortie différent de `0`). Cela empêche l'exécution de commandes ultérieures après un échec.
- **`set -u` (Unset variables)** : Le script s'arrête immédiatement si une variable non initialisée est référencée, évitant les comportements imprévisibles liés à des variables d'environnement manquantes.
- **`set -o pipefail` (Pipeline failure propagation)** : Par défaut, dans une chaîne de commandes reliées par des pipes (`cmd1 | cmd2`), seul le code de sortie de `cmd2` est retenu. L'option `pipefail` garantit que si `cmd1` échoue, la chaîne entière est considérée comme en échec.

### 3.2. Traitement et Transmission des Codes de Sortie (`0` ou `1`)

Le runner GitHub Actions s'appuie sur le **code de sortie (Exit Code)** du script Shell pour déterminer si une étape est validée ou en échec :
- **Code `0`** : Succès. Le pipeline passe à l'étape suivante.
- **Code `!= 0` (généralement `1`)** : Échec. Le pipeline s'interrompt immédiatement.

#### Modèle de Script Shell Canonisé (`scripts/test-unit.sh`) :

```bash
#!/usr/bin/env bash
# ==============================================================================
# Script Canonisé : Exécution des Tests Unitaires
# ==============================================================================
set -euo pipefail

echo "=================================================="
echo " [CI/CD] Lancement des Tests Unitaires"
echo "=================================================="

# Exécution des tests propres à la stack du projet
npm run test:unit

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo " [CI/CD] Tests unitaires validés avec succès (Exit Code: 0)"
else
  echo " [CI/CD] Échec des tests unitaires (Exit Code: $EXIT_CODE)"
fi

exit $EXIT_CODE
```

---

## 4. Analyse et Fonctionnement du Workflow CI/CD (`main.yaml`)

Le fichier `.github/workflows/main.yaml` orchestre le pipeline en s'appuyant sur des **conteneurs Docker dédiés** par étape pour isoler et fournir le SDK approprié.

### 4.1. Structure du Workflow

```yaml
name: CI/CD React to On-Prem K8s

on:
  push:
    branches:
      - dimitri
    paths:
      - 'release.version'
    paths-ignore:
      - 'README.md'

jobs:
  test-unit:
    runs-on: ubuntu-latest
    container:
      image: node:24
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Install dependencies
        run: sh ./scripts/setup.sh
      - name: Run unit tests
        run: sh ./scripts/test-unit.sh

  test-sast:
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep:latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Run SAST scan (Semgrep)
        run: sh ./scripts/test-sast.sh

  image-factory:
    needs: test-sast
    outputs:
      version: ${{ steps.get_version.outputs.VERSION }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Login to Docker Registry
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Get version from release.version
        id: get_version
        run: |
          VERSION=$(cat release.version)
          echo "VERSION=$VERSION" >> $GITHUB_ENV
          echo "VERSION=$VERSION" >> $GITHUB_OUTPUT

      - name: Build Docker image
        run: |
          docker build -t hexapass:${{ env.VERSION }} .

      - name: Scan Docker image via Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'image'
          scan-ref: hexapass:${{ env.VERSION }}
          format: table
          output: 'trivy-results.sarif'
          severity: CRITICAL,HIGH
          exit-code: 0

      - name: Push Docker image
        run: |
          docker tag hexapass:${{ env.VERSION }} frantzdimitrikubecloud/hexapass:${{ env.VERSION }}
          docker push frantzdimitrikubecloud/hexapass:${{ env.VERSION }}
```

### 4.2. Description des Jobs Canonisés

1. **Job `test-unit`** :
   - **Environnement Conteneurisé (Image Personnalisée / SDK)** : S'exécute dans une image Docker dédiée (ex: `node:24` ou une image d'outillage personnalisée centralisée pré-construite). Cette image embarque tous les SDKs, bibliothèques et runners de tests requis pour le service.
   - **Exécution** : Lance `sh ./scripts/setup.sh` puis `sh ./scripts/test-unit.sh`.
   - **Comportement** : Valide la totalité de la suite de tests unitaires du projet. En cas d'erreur de test, le script sort avec le code `1` et bloque le job.

2. **Job `test-sast`** :
   - **Environnement Conteneurisé** : Utilise l'image dédiée `semgrep/semgrep:latest` (ou une image SAST entreprise personnalisée pré-packagée).
   - **Exécution** : Exécute `sh ./scripts/test-sast.sh`.
   - **Sécurité** : Réalise l'analyse statique du code source et filtre les fichiers via `.semgrepignore`.

3. **Job `image-factory`** :
   - **Dépendance Strict** : S'exécute uniquement si l'analyse SAST et les tests sont validés (`needs: test-sast`).
   - **Gestion Dynamique des Versions** : Lit le fichier `release.version` pour taguer l'image de manière déterministe.
   - **Scan de l'Image Conteneurisée (Trivy)** : Analyse l'image construite pour détecter les vulnérabilités de système d'exploitation et de dépendances (`CRITICAL,HIGH`).
   - **Publication** : Pousse l'image validée vers le registre de conteneurs Docker Hub.

---

## 5. Synthèse des Avantages de la Méthodologie

- **Uniformité Enterprise** : Un seul modèle de pipeline pour 100% des microservices de l'entreprise.
- **Simplicité de Maintenance** : Toute modification du moteur CI/CD est répercutée sans impacter le code source des projets.
- **Sécurité Intégrée (DevSecOps)** : Intégration systématique des scanners SAST (Semgrep) et d'images (Trivy) avec blocage Fail-Fast.
- **Autonomie des Équipes** : Les équipes de développement maîtrisent leurs scripts de test (`/scripts/`) sans devoir modifier les configurations du pipeline d'infrastructure.
