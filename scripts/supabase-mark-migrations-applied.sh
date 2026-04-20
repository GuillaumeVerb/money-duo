#!/usr/bin/env bash
# Marque des migrations locales comme déjà appliquées sur le projet linké,
# sans exécuter leur SQL (cas : base distante déjà créée, historique migrations vide / réparé).
#
# Usage (depuis la racine du repo, après supabase link) :
#   bash scripts/supabase-mark-migrations-applied.sh              # tout sauf les correctifs RLS households (2026040814/15)
#   bash scripts/supabase-mark-migrations-applied.sh --all        # tout y compris RLS (si SQL déjà joué à la main)
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Migrations à laisser à db push (RLS insert households + variante sans TO authenticated).
SKIP_VERSIONS="20260408140000 20260408150000 20260408160000 20260408161000"
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
  if [[ "$ALL" -eq 0 ]]; then
    skip=0
    for s in $SKIP_VERSIONS; do
      if [[ "$ver" == "$s" ]]; then skip=1; break; fi
    done
    if [[ "$skip" -eq 1 ]]; then
      echo "On laisse à db push: $ver ($base)"
      continue
    fi
  fi
  echo "migration repair --status applied $ver  ($base)"
  supabase migration repair --status applied "$ver"
done

echo ""
echo "Ensuite : supabase db push"
if [[ "$ALL" -eq 0 ]]; then
  echo "(db push devrait appliquer au moins : $SKIP_VERSIONS ; si déjà en base, --all puis db push.)"
fi
