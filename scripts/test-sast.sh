#!/usr/bin/env bash
# ==============================================================================
# Pipeline Canonique : Analyse Statique de Sécurité (SAST) via Semgrep
# Propriétés : Fail-Fast (set -euo pipefail), scan de vulnérabilités
# ==============================================================================
set -euo pipefail

echo "=================================================="
echo " [CI/CD] Lancement de l'analyse SAST (Semgrep)"
echo "=================================================="

# Exécution du scan Semgrep
# --config auto : applique les règles recommandées (OWASP Top 10, CWE, etc.)
# --error : renvoie un code d'erreur (exit code != 0) si des vulnérabilités critiques sont trouvées
semgrep scan --config auto --error

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo " [CI/CD] Analyse SAST validée sans vulnérabilités bloquantes (Exit Code: 0)"
else
  echo " [CI/CD] Vulnérabilités détectées par Semgrep (Exit Code: $EXIT_CODE)"
fi

exit $EXIT_CODE
