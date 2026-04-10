/** Clés AsyncStorage centralisées (préfixes Money Duo). */
export const STORAGE_KEYS = {
  remindersEnabled: 'moneyduo_prefs_reminders_v1',
  scheduledReminderId: 'moneyduo_scheduled_reminder_id_v1',
  analyticsOptIn: 'moneyduo_prefs_analytics_v1',
  analyticsEvents: 'moneyduo_analytics_events_v1',
  productTourDone: 'moneyduo_product_tour_v1',
  /** JSON : vues filtre dépenses par foyer */
  expenseSavedViews: 'moneyduo_expense_saved_views_v1',
  /** JSON : { "[householdId]:[monthKey]": notificationId } */
  decisionMemoReminderMap: 'moneyduo_decision_memo_reminder_map_v1',
  /** Heure 0–23 pour rappels locaux (mémo + hebdo), défaut 9 */
  preferredReminderHour: 'moneyduo_preferred_reminder_hour_v1',
  /** JSON : règles mot-clé → catégorie par foyer */
  expenseAutoRules: 'moneyduo_expense_auto_rules_v1',
} as const;
