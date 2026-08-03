#!/usr/bin/env bash
# To‘liq pipeline (WSL ichida deps+build; Windows’da node qismi alohida).
# Eslatma: export/import Node Windows’da ishlaydi (MySQL .env).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/00-install-deps.sh"
bash "$SCRIPT_DIR/01-build-kaa.sh"
echo ""
echo "Keyingi qadamlar WINDOWS PowerShell’da:"
echo "  node scripts/export-dict-for-apertium.mjs"
echo "  wsl -e bash scripts/apertium/02-analyze-dict.sh"
echo "  node scripts/import-apertium-morph.mjs"
