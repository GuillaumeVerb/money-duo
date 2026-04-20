#!/usr/bin/env bash
# Exécute un fichier .sql sur la base Postgres du projet (remote).
#
# Prérequis : chaîne de connexion Postgres (pas la clé anon).
# Dashboard Supabase → Project Settings → Database → Connection string → URI
# (souvent port 5432 session / direct ; ou pooler « session » si indiqué).
#
# Usage :
#   export SUPABASE_DB_URL='postgresql://postgres:TON_MOT_DE_PASSE@db.xxxxx.supabase.co:5432/postgres'
#   bash scripts/apply-remote-sql-file.sh supabase/sql-dashboard/02_bootstrap_new_household_rpc.sql
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
FILE="${1:-supabase/sql-dashboard/02_bootstrap_new_household_rpc.sql}"
ABS="$ROOT/$FILE"

if [[ -z "$URL" ]]; then
  echo "Définis SUPABASE_DB_URL ou DATABASE_URL (URI Postgres du dashboard), puis relance." >&2
  exit 1
fi
if [[ ! -f "$ABS" ]]; then
  echo "Fichier introuvable: $ABS" >&2
  exit 1
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "Installe le client Postgres (psql), ex. : brew install libpq && brew link --force libpq" >&2
  exit 1
fi

psql "$URL" -v ON_ERROR_STOP=1 -f "$ABS"
echo "OK : $FILE"
