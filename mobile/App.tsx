import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { HouseholdProvider } from './src/context/HouseholdContext';
import { ToastProvider } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation/RootNavigator';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export default function App () {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HouseholdProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ToastProvider>
        </HouseholdProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
