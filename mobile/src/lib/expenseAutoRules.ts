import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';

export type ExpenseAutoRule = {
  id: string;
  /** Sous-chaîne recherchée dans la note (insensible à la casse). */
  keyword: string;
  category_id: string;
};

type Store = Record<string, ExpenseAutoRule[]>;

async function readAll (): Promise<Store> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.expenseAutoRules);
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Store;
  } catch {
    return {};
  }
}

async function writeAll (store: Store): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEYS.expenseAutoRules,
    JSON.stringify(store)
  );
}

export async function loadExpenseAutoRules (
  householdId: string
): Promise<ExpenseAutoRule[]> {
  const store = await readAll();
  return store[householdId] ?? [];
}

export async function saveExpenseAutoRules (
  householdId: string,
  rules: ExpenseAutoRule[]
): Promise<void> {
  const store = await readAll();
  store[householdId] = rules.slice(-40);
  await writeAll(store);
}

export async function addExpenseAutoRule (
  householdId: string,
  rule: Omit<ExpenseAutoRule, 'id'>
): Promise<ExpenseAutoRule[]> {
  const list = await loadExpenseAutoRules(householdId);
  const id = `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const next: ExpenseAutoRule = {
    id,
    keyword: rule.keyword.trim().slice(0, 80),
    category_id: rule.category_id,
  };
  if (next.keyword.length === 0) {
    return list;
  }
  const merged = [...list.filter((x) => x.keyword.toLowerCase() !== next.keyword.toLowerCase()), next];
  await saveExpenseAutoRules(householdId, merged);
  return merged;
}

export async function removeExpenseAutoRule (
  householdId: string,
  ruleId: string
): Promise<ExpenseAutoRule[]> {
  const list = (await loadExpenseAutoRules(householdId)).filter(
    (r) => r.id !== ruleId
  );
  await saveExpenseAutoRules(householdId, list);
  return list;
}

/**
 * Retourne l’id de catégorie de la première règle dont le mot-clé est contenu dans la note.
 */
export function matchExpenseAutoRule (
  note: string,
  rules: ExpenseAutoRule[]
): string | null {
  const n = note.trim().toLowerCase();
  if (!n) {
    return null;
  }
  for (const r of rules) {
    const k = r.keyword.trim().toLowerCase();
    if (k.length > 0 && n.includes(k)) {
      return r.category_id;
    }
  }
  return null;
}
