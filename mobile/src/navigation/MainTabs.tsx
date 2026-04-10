import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SplitScreen } from '../screens/SplitScreen';
import { colors, fontSize, fontWeight, hairline, shadow, spacing } from '../theme/tokens';

export type ExpensesTabParams = {
  /** Consommés une fois au focus (ex. lien depuis le récap). */
  initialScope?: 'month' | 'all';
  /** `all` = toutes les catégories ; `none` = sans catégorie ; sinon id catégorie. */
  initialCategory?: 'all' | 'none' | string;
  /** Mois ciblé `YYYY-MM` (ex. lien depuis le récap mensuel). */
  monthKey?: string;
};

export type MainTabParamList = {
  Home: undefined;
  Expenses: ExpensesTabParams | undefined;
  Split: undefined;
  Goals: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Expenses: 'receipt-outline',
  Split: 'scale-outline',
  Goals: 'flag-outline',
  Settings: 'settings-outline',
};

const ICONS_FOCUSED: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Expenses: 'receipt',
  Split: 'scale',
  Goals: 'flag',
  Settings: 'settings',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Accueil',
  Expenses: 'Dépenses',
  Split: 'Équilibre',
  Goals: 'Objectifs',
  Settings: 'Réglages',
};

function NativeStyleTabBar ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10);

  return (
    <View
      style={[
        styles.tabShell,
        {
          paddingBottom: bottom,
          ...Platform.select({
            ios: shadow.tabBar,
            android: {},
          }),
        },
      ]}
    >
      <View style={styles.tabInner}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const name = route.name as keyof MainTabParamList;
          const { options } = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const color = isFocused ? colors.primary : colors.textMuted;
          const icon = isFocused ? ICONS_FOCUSED[name] : ICONS[name];
          const label =
            (typeof options.tabBarLabel === 'string' && options.tabBarLabel) ||
            TAB_LABELS[name];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && styles.tabPressed,
              ]}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapOn]}>
                <Ionicons name={icon} size={24} color={color} />
              </View>
              <Text
                style={[styles.tabText, isFocused && styles.tabTextOn]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MainTabs () {
  return (
    <Tab.Navigator
      tabBar={(props) => <NativeStyleTabBar {...props} />}
      screenOptions={{
        /** Titres portés par chaque écran — évite doublon avec le header natif. */
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Accueil', tabBarLabel: 'Accueil' }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesScreen}
        options={{ title: 'Dépenses', tabBarLabel: 'Dépenses' }}
      />
      <Tab.Screen
        name="Split"
        component={SplitScreen}
        options={{ title: 'Répartition', tabBarLabel: 'Équilibre' }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{ title: 'Objectifs', tabBarLabel: 'Objectifs' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Réglages', tabBarLabel: 'Réglages' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabShell: {
    backgroundColor: colors.surface,
    borderTopWidth: hairline,
    borderTopColor: colors.borderLight,
    ...Platform.select({
      android: { elevation: 6 },
      default: {},
    }),
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    minHeight: 52,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  tabPressed: {
    opacity: 0.75,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: colors.primarySoft,
  },
  tabText: {
    fontSize: fontSize.micro,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    letterSpacing: 0.15,
  },
  tabTextOn: {
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
});
