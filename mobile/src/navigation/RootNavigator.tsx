import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { colors } from '../theme/tokens';
import { MainTabs } from './MainTabs';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { supabase } from '../lib/supabase';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Main: undefined;
  AddExpense: { expenseId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator () {
  const { session, loading: authLoading } = useAuth();
  const { household, loading: hhLoading, refresh } = useHousehold();
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(
    null
  );

  useEffect(() => {
    const parse = (url: string | null) => {
      if (!url) {
        return;
      }
      const parsed = Linking.parse(url);
      const raw = parsed.queryParams?.token;
      const t = Array.isArray(raw) ? raw[0] : raw;
      if (typeof t === 'string' && t.length > 0) {
        setPendingInviteToken(t);
      }
    };
    void Linking.getInitialURL().then(parse);
    const sub = Linking.addEventListener('url', (ev) => {
      parse(ev.url);
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.user || !pendingInviteToken) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.rpc('accept_household_invite', {
        _token: pendingInviteToken,
      });
      if (!cancelled && !error && data) {
        setPendingInviteToken(null);
        await refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, pendingInviteToken, refresh]);

  if (authLoading || (session && hhLoading)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.neutralWarm,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const showOnboarding = session && !household;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : showOnboarding ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="AddExpense"
              component={AddExpenseScreen}
              options={({ route }) => ({
                presentation: 'modal',
                headerShown: true,
                title: route.params?.expenseId
                  ? 'Modifier la dépense'
                  : 'Ajouter une dépense',
                headerTintColor: colors.accent,
              })}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
