import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Text } from 'react-native';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplitScreen } from '../screens/SplitScreen';
import { colors } from '../theme/tokens';

export type MainTabParamList = {
  Home: undefined;
  Expenses: undefined;
  Split: undefined;
  Goals: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function tabLabel (label: string) {
  return {
    tabBarLabel: ({ focused }: { focused: boolean }) => (
      <Text
        style={{
          fontSize: 11,
          color: focused ? colors.accent : colors.neutralMuted,
          fontWeight: focused ? '600' : '400',
        }}
      >
        {label}
      </Text>
    ),
  };
}

export function MainTabs () {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.accent,
        headerStyle: { backgroundColor: colors.neutralWarm },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Accueil',
          ...tabLabel('Accueil'),
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{
          title: 'Dépenses',
          ...tabLabel('Dépenses'),
        }}
      />
      <Tab.Screen
        name="Split"
        component={SplitScreen}
        options={{
          title: 'Répartition',
          ...tabLabel('Répartition'),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          title: 'Objectifs',
          ...tabLabel('Objectifs'),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Paramètres',
          ...tabLabel('Réglages'),
        }}
      />
    </Tab.Navigator>
  );
}
