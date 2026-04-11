# Déployer Money Duo (web mobile, multi-utilisateur)

## Stack cible

- **Front** : Expo + React Native (une codebase : web PWA + builds iOS/Android via [EAS Build](https://docs.expo.dev/build/introduction/)).
- **Backend** : Supabase (PostgreSQL + Auth + Row Level Security).
- **Pas** de synchro bancaire dans ce guide.

## 1. Backend Supabase (obligatoire)

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Appliquer les migrations du dossier `../supabase/migrations/` (`supabase db push` ou SQL manuel).
3. **Authentication → URL configuration** : ajouter l’URL publique de ton app (ex. `https://ton-app.vercel.app`) dans *Site URL* et *Redirect URLs*.
4. Récupérer **Project URL** et **anon public key** pour le client.

## 2. Variables d’environnement (build web)

Dans `mobile/.env` (ou variables CI) :

| Variable | Rôle |
|----------|------|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon (jamais la service role côté client) |
| `EXPO_PUBLIC_WEB_APP_URL` | URL **stable** où l’app est servie (ex. `https://moneyduo.vercel.app`) — utilisée pour les liens d’invitation et les e-mails Auth |

Sans les deux premières, l’app reste utilisable en **aperçu** uniquement (données locales fictives).

## 3. Build statique web

```bash
cd mobile
npm install
npx expo export --platform web
```

Le dossier de sortie est en général `dist/` (vérifier la sortie du CLI Expo).

## 4. Hébergement (exemples)

- **Vercel / Netlify / Cloudflare Pages** : déployer le contenu exporté (`dist`) comme site statique.
- Définir les mêmes `EXPO_PUBLIC_*` dans les variables d’environnement du projet d’hébergement **au moment du build**.

## 5. Invitation partenaire

Après déploiement, avec `EXPO_PUBLIC_WEB_APP_URL` défini, le lien généré à l’onboarding pointe vers  
`https://ton-domaine/?token=...`  
Le second membre ouvre ce lien **déjà connecté** (ou se connecte puis rouvre le lien) : l’app consomme le token et appelle `accept_household_invite`.

## 6. Sécurité minimale

Les politiques RLS du schéma initial isolent les données par foyer (`is_household_member`). Ne jamais exposer la **service role** dans le bundle web.

## 7. Suppression des données (RGPD / beta)

- L’app appelle la RPC Postgres `purge_my_account_household_data` (migration `20260408120000_purge_my_account_household_data.sql`) : effacement des foyers / profil applicatif pour l’utilisateur connecté, puis déconnexion.
- Cela **ne supprime pas** automatiquement la ligne `auth.users` (e-mail de connexion). Pour une effacement complet du compte Auth : tableau Supabase **Authentication → Users**, ou une **Edge Function** avec la clé service role (hors bundle client).
- Optionnel : `EXPO_PUBLIC_SUPPORT_EMAIL` pour le lien « Contacter le support » ; URLs légales externes via `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_URL`.

## 8. CI (GitHub Actions)

Le dépôt inclut un workflow qui lance `npm run typecheck` et `npm test` dans `mobile/` sur les push et pull requests vers `main`.

## 9. Builds natifs (TestFlight, Play interne, stores)

Pour distribuer une **app installable** (pas seulement le site web) :

1. Compte [Expo](https://expo.dev). En local : `cd mobile && npm ci` (EAS est fourni via `eas-cli` en devDependency).
2. **Jeton** : crée un *access token* sur [expo.dev → compte → Access tokens](https://expo.dev/accounts/_/settings/access-tokens), puis `export EXPO_TOKEN=...` dans ton terminal **ou** `npx eas-cli@latest login`.
3. **Une commande (recommandé)** : avec `mobile/.env` rempli comme pour le web, exécute `npm run eas:bootstrap`. Le script lance `eas init` si besoin, puis pousse les secrets `EXPO_PUBLIC_*` vers le projet EAS. Avec **`app.config.js`** (config dynamique), Expo ne peut pas écrire le `projectId` tout seul : si `eas init` affiche un UUID à copier, ajoute `extra.eas.projectId` et `owner` dans `app.config.js` comme dans le dépôt, puis relance `npm run eas:bootstrap` pour les secrets. **Commit** le `app.config.js` mis à jour.
4. Alternative manuelle : `npm run eas:init`, puis secrets via le dashboard EAS ou `eas secret:create --scope project --name EXPO_PUBLIC_...`.
5. **Identifiants** : `ios.bundleIdentifier` et `android.package` sont dans `app.config.js` (`com.moneyduo.app`). À ajuster **avant** la première soumission store si besoin.
6. **Auth / deep links** : dans Supabase, ajoute le schème `moneyduo://` (et les redirect URLs indiquées par Expo après un build) dans *Redirect URLs*, en plus de l’URL web.
7. **Build** : `npm run eas:build:android` / `eas:build:ios` / `eas:build:all` (profil `production`). Profil `preview` dans `eas.json` : APK interne Android.
8. **CI GitHub** : ajoute le secret dépôt `EXPO_TOKEN`, puis lance le workflow **EAS Build** (*Actions* → *EAS Build* → *Run workflow*). Nécessite un `app.config.js` déjà commité avec `extra.eas.projectId`.
9. **Soumission stores** : Apple Developer + Google Play ; `eas submit` ([doc](https://docs.expo.dev/submit/introduction/)). Prévoir métadonnées et URL de politique de confidentialité si requis.
