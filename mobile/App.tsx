import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { HouseholdProvider } from './src/context/HouseholdContext';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App () {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HouseholdProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </HouseholdProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
