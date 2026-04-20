import {
  NavigationContainer,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { useHousehold } from '../context/HouseholdContext';
import { colors, fontSize, fontWeight } from '../theme/tokens';
import { MainTabs, type MainTabParamList } from './MainTabs';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { MonthlyRecapScreen } from '../screens/MonthlyRecapScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HelpScreen } from '../screens/HelpScreen';
import { LegalInfoScreen } from '../screens/LegalInfoScreen';
import { GoalDetailScreen } from '../screens/GoalDetailScreen';
import { DecisionMemoHistoryScreen } from '../screens/DecisionMemoHistoryScreen';
import { RecurringChargesScreen } from '../screens/RecurringChargesScreen';
import { MonthHistoryScreen } from '../screens/MonthHistoryScreen';
import { FinancialCharterScreen } from '../screens/FinancialCharterScreen';
import { LightSimulatorScreen } from '../screens/LightSimulatorScreen';
import { supabase } from '../lib/supabase';
import type { Goal } from '../lib/types';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  AddExpense: { expenseId?: string; duplicateFromId?: string } | undefined;
  ExpenseDetail: { expenseId: string };
  MonthlyRecap: { initialMonthKey?: string } | undefined;
  Help: undefined;
  LegalInfo: { document: 'privacy' | 'terms' };
  GoalDetail: { goalId?: string; goalSnapshot?: Goal } | undefined;
  RecurringCharges: undefined;
  DecisionMemoHistory: undefined;
  MonthHistory: undefined;
  FinancialCharter: undefined;
  LightSimulator: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator () {
  const { session, demoMode, isAuthenticated, loading: authLoading } =
    useAuth();
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
    if (demoMode || !session?.user || !pendingInviteToken) {
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
  }, [session?.user, pendingInviteToken, refresh, demoMode]);

  if (authLoading || (isAuthenticated && hhLoading)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.canvas,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const showOnboarding = isAuthenticated && !household;

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={showOnboarding ? 'stack-onboarding' : 'stack-main'}
        screenOptions={{ headerShown: false }}
      >
        {!isAuthenticated ? (
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
                  : route.params?.duplicateFromId
                    ? 'Dupliquer'
                    : 'Nouvelle dépense',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              })}
            />
            <Stack.Screen
              name="ExpenseDetail"
              component={ExpenseDetailScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Détail',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              }}
            />
            <Stack.Screen
              name="MonthlyRecap"
              component={MonthlyRecapScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Récap du mois',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              }}
            />
            <Stack.Screen
              name="Help"
              component={HelpScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Aide',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              }}
            />
            <Stack.Screen
              name="LegalInfo"
              component={LegalInfoScreen}
              options={({ route }) => ({
                presentation: 'modal',
                headerShown: true,
                title:
                  route.params?.document === 'privacy'
                    ? 'Confidentialité'
                    : 'CGU',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              })}
            />
            <Stack.Screen
              name="GoalDetail"
              component={GoalDetailScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Objectif',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              }}
            />
            <Stack.Screen
              name="RecurringCharges"
              component={RecurringChargesScreen}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="DecisionMemoHistory"
              component={DecisionMemoHistoryScreen}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="MonthHistory"
              component={MonthHistoryScreen}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="FinancialCharter"
              component={FinancialCharterScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Contrat léger',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              }}
            />
            <Stack.Screen
              name="LightSimulator"
              component={LightSimulatorScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                title: 'Simulateur',
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTitleStyle: {
                  fontSize: fontSize.titleSm,
                  fontWeight: fontWeight.semibold,
                  color: colors.text,
                },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
