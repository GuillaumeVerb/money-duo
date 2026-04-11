#!/usr/bin/env bash
# Lie le dossier à un projet EAS (crée le projet si besoin) et pousse les secrets
# build à partir de mobile/.env. Prérequis : EXPO_TOKEN ou session `eas login`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v npx >/dev/null 2>&1; then
  echo "npx est requis (Node.js)."
  exit 1
fi

eas_cli () {
  npx eas "$@"
}

if [[ -z "${EXPO_TOKEN:-}" ]] && ! eas_cli whoami >/dev/null 2>&1; then
  echo "Définis EXPO_TOKEN (https://expo.dev/accounts/[compte]/settings/access-tokens)"
  echo "ou exécute : cd mobile && npx eas login"
  exit 1
fi

# app.config.js dynamique : EAS n’écrit pas le projectId tout seul — il doit être dans extra.eas.
if grep -q "projectId" "$ROOT/app.config.js"; then
  echo "→ Projet EAS déjà lié (extra.eas.projectId dans app.config.js) — pas de eas init."
else
  echo "→ eas init (crée le projet ; si échec « dynamic config », ajoute extra.eas.projectId manuellement puis relance)"
  eas_cli init --non-interactive --force
fi

ENV_FILE="$ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Pas de mobile/.env — secrets non poussés. Copie .env.example vers .env puis relance ce script."
  exit 0
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

push_secret () {
  local name="$1"
  local val="${!name-}"
  if [[ -n "${val// }" ]]; then
    echo "→ secret projet : $name"
    eas_cli secret:create --scope project --name "$name" --value "$val" --type string \
      --force --non-interactive
  fi
}

push_secret EXPO_PUBLIC_SUPABASE_URL
push_secret EXPO_PUBLIC_SUPABASE_ANON_KEY
push_secret EXPO_PUBLIC_WEB_APP_URL
push_secret EXPO_PUBLIC_SUPPORT_EMAIL
push_secret EXPO_PUBLIC_PRIVACY_POLICY_URL
push_secret EXPO_PUBLIC_TERMS_URL

echo "Terminé. Commit app.config.js (projectId). Ensuite : npm run eas:build:android (ou ios / all)."
