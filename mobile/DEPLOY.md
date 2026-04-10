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

1. Compte [Expo](https://expo.dev) et CLI : `npm i -g eas-cli` ou utiliser `npx eas-cli@latest`.
2. Une fois par dépôt : `cd mobile && npm run eas:init` — lie le projet Expo et écrit `extra.eas.projectId` dans `app.config.js` (à committer).
3. **Identifiants** : `ios.bundleIdentifier` et `android.package` sont définis dans `app.config.js` (`com.moneyduo.app`). Change-les si besoin **avant** la première soumission store (souvent figés ensuite).
4. **Variables `EXPO_PUBLIC_*`** : les mêmes que pour le web doivent être présentes **au moment du build** EAS (dashboard projet EAS → *Environment variables*, ou `eas secret:create` / secrets par profil). Sans elles, l’app peut tourner en mode démo locale uniquement.
5. **Auth / deep links** : dans Supabase, ajoute le schème custom `moneyduo://` (et les URLs de redirect EAS si Expo les fournit) dans *Redirect URLs*, en plus de l’URL web.
6. **Lancer un build** :
   - `npm run eas:build:ios` / `eas:build:android` / `eas:build:all` (profil `production` dans `eas.json`).
   - Profil `preview` : binaire **interne** (ex. APK Android pour testeurs sans Play Store).
7. **Soumission stores** : comptes Apple Developer et Google Play Console ; ensuite `eas submit` ([doc](https://docs.expo.dev/submit/introduction/)). Prévoir fiches App Store / Play (confidentialité, captures, politique de confidentialité URL si requis).
