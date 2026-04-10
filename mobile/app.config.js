/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'Money Duo',
    slug: 'money-duo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'moneyduo',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#F4F1EC',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.moneyduo.app',
    },
    android: {
      package: 'com.moneyduo.app',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: { favicon: './assets/favicon.png' },
    plugins: [
      'expo-sharing',
      'expo-notifications',
      '@react-native-community/datetimepicker',
    ],
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '',
      privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '',
      termsUrl: process.env.EXPO_PUBLIC_TERMS_URL ?? '',
    },
  },
};
