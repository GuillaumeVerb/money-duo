import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExpenseType } from './types';
import { STORAGE_KEYS } from './storageKeys';

export type CategoryFilterToken = 'all' | 'none' | string;

export type ExpenseSavedView = {
  id: string;
  name: string;
  scope: 'month' | 'all';
  categoryFilter: CategoryFilterToken;
  typeFilter: 'all' | ExpenseType;
};

type Store = Record<string, ExpenseSavedView[]>;

async function readAll (): Promise<Store> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.expenseSavedViews);
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
  await AsyncStorage.setItem(STORAGE_KEYS.expenseSavedViews, JSON.stringify(store));
}

export async function loadExpenseSavedViews (
  householdId: string
): Promise<ExpenseSavedView[]> {
  const store = await readAll();
  return store[householdId] ?? [];
}

export async function saveExpenseSavedView (
  householdId: string,
  view: Omit<ExpenseSavedView, 'id'> & { id?: string }
): Promise<ExpenseSavedView[]> {
  const store = await readAll();
  const list = [...(store[householdId] ?? [])];
  const id = view.id ?? `v_${Date.now().toString(36)}`;
  const next: ExpenseSavedView = {
    id,
    name: view.name.trim().slice(0, 40) || 'Ma vue',
    scope: view.scope,
    categoryFilter: view.categoryFilter,
    typeFilter: view.typeFilter,
  };
  const idx = list.findIndex((v) => v.id === id);
  if (idx >= 0) {
    list[idx] = next;
  } else {
    list.push(next);
  }
  store[householdId] = list.slice(-12);
  await writeAll(store);
  return store[householdId];
}

export async function removeExpenseSavedView (
  householdId: string,
  viewId: string
): Promise<ExpenseSavedView[]> {
  const store = await readAll();
  const list = (store[householdId] ?? []).filter((v) => v.id !== viewId);
  store[householdId] = list;
  await writeAll(store);
  return list;
}
