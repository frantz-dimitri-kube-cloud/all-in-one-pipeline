#!/usr/bin/env bash
# ==============================================================================
# Pipeline Canonique : Point d'entrée des tests unitaires
# Propriétés : Fail-Fast (set -euo pipefail), SDK Node.js
# ==============================================================================
set -e pipefail

echo "=================================================="
echo " [CI/CD] Lancement des Tests Unitaires (SDK Node.js)"
echo "=================================================="

# Exécution des tests unitaires via Vitest
npm run test:unit

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo " [CI/CD] Tests unitaires validés avec succès (Exit Code: 0)"
else
  echo " [CI/CD] Échec des tests unitaires (Exit Code: $EXIT_CODE)"
fi

exit $EXIT_CODE
