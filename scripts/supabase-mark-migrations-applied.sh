#!/usr/bin/env bash
# Marque des migrations locales comme déjà appliquées sur le projet linké,
# sans exécuter leur SQL (cas : base distante déjà créée, historique migrations vide / réparé).
#
# Usage (depuis la racine du repo, après supabase link) :
#   bash scripts/supabase-mark-migrations-applied.sh              # tout sauf la RLS households
#   bash scripts/supabase-mark-migrations-applied.sh --all        # tout y compris RLS (si SQL déjà joué à la main)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SKIP_RLS="20260408140000"
ALL=0
if [[ "${1:-}" == "--all" ]]; then
  ALL=1
fi

for f in "$ROOT/supabase/migrations"/*.sql; do
  base="$(basename "$f" .sql)"
  ver="$(echo "$base" | sed -n 's/^\([0-9]\{14\}\).*/\1/p')"
  if [[ -z "$ver" ]]; then
    echo "Ignoré (pas de préfixe 14 chiffres): $base" >&2
    continue
  fi
  if [[ "$ALL" -eq 0 && "$ver" == "$SKIP_RLS" ]]; then
    echo "On laisse à db push: $ver ($base)"
    continue
  fi
  echo "migration repair --status applied $ver  ($base)"
  supabase migration repair --status applied "$ver"
done

echo ""
echo "Ensuite : supabase db push"
if [[ "$ALL" -eq 0 ]]; then
  echo "(devrait n’appliquer que ${SKIP_RLS}… si cette migration est déjà en base, relance ce script avec --all puis db push.)"
fi
