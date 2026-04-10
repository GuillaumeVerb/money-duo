import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { demoHomeCockpit, demoHousehold } from './demoData';
import { supabase } from './supabase';
import type { Category, ExpenseType, HouseholdMember, SplitRuleKind } from './types';

const SEP = ';';

function escapeField (s: string): string {
  const needsQuote = /[;"\n\r]/.test(s);
  const t = s.replace(/"/g, '""');
  return needsQuote ? `"${t}"` : t;
}

function rowCsv (cells: string[]): string {
  return cells.map(escapeField).join(SEP);
}

type Row = {
  spent_at: string;
  amount: number;
  currency: string;
  category: string;
  expense_type: string;
  payer: string;
  split_rule: string;
  note: string;
};

function buildCsv (rows: Row[], currency: string): string {
  const header = rowCsv([
    'date',
    'montant',
    'devise',
    'categorie',
    'type',
    'payeur',
    'regle_partage',
    'note',
  ]);
  const lines = [
    header,
    ...rows.map((r) =>
      rowCsv([
        r.spent_at,
        String(r.amount).replace('.', ','),
        currency,
        r.category,
        r.expense_type,
        r.payer,
        r.split_rule,
        r.note,
      ])
    ),
  ];
  return '\uFEFF' + lines.join('\r\n');
}

function memberName (
  members: HouseholdMember[],
  payerId: string | null
): string {
  if (!payerId) {
    return '';
  }
  return members.find((m) => m.id === payerId)?.display_name ?? payerId;
}

function catName (
  categories: Category[],
  categoryId: string | null
): string {
  if (!categoryId) {
    return '';
  }
  return categories.find((c) => c.id === categoryId)?.name ?? '';
}

export type ExportCsvParams = {
  householdId: string;
  currency: string;
  demoMode: boolean;
  members: HouseholdMember[];
  categories: Category[];
};

export type ExportCsvResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Exporte les dépenses en CSV (séparateur `;`, UTF-8 avec BOM pour Excel) puis ouvre le partage système.
 */
export async function exportHouseholdExpensesCsv (
  params: ExportCsvParams
): Promise<ExportCsvResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      message:
        'L’export fichier n’est pas disponible sur le web — utilisez l’app iOS ou Android.',
    };
  }

  if (!cacheDirectory) {
    return { ok: false, message: 'Dossier cache indisponible.' };
  }

  let rows: Row[] = [];

  if (params.demoMode) {
    const y = new Date().getFullYear();
    const mo = String(new Date().getMonth() + 1).padStart(2, '0');
    const demoRows = demoHomeCockpit.recentExpenses.map((r) => ({
      spent_at: `${y}-${mo}-${String(r.day).padStart(2, '0')}`,
      amount: r.amount,
      currency: demoHousehold.currency,
      category: r.cat,
      expense_type: 'shared',
      payer: params.members[0]?.display_name ?? '—',
      split_rule: 'equal',
      note: r.label,
    }));
    rows = demoRows;
  } else {
    const { data, error } = await supabase
      .from('expenses')
      .select(
        'amount, spent_at, note, expense_type, category_id, payer_member_id, split_rule_snapshot'
      )
      .eq('household_id', params.householdId)
      .order('spent_at', { ascending: false });

    if (error) {
      return { ok: false, message: error.message };
    }

    rows = (data ?? []).map((raw) => {
      const spent = String(raw.spent_at).slice(0, 10);
      const payerId = raw.payer_member_id as string | null;
      const catId = (raw.category_id as string | null) ?? null;
      const rule = raw.split_rule_snapshot as SplitRuleKind | null;
      return {
        spent_at: spent,
        amount: Number(raw.amount),
        currency: params.currency,
        category: catName(params.categories, catId),
        expense_type: String(raw.expense_type),
        payer: memberName(params.members, payerId),
        split_rule: rule ?? '',
        note: (raw.note as string | null) ?? '',
      };
    });
  }

  const csv = buildCsv(rows, params.currency);
  const safeName = `moneyduo-depenses-${new Date().toISOString().slice(0, 10)}.csv`;
  const uri = `${cacheDirectory}${safeName}`;
  await writeAsStringAsync(uri, csv, { encoding: 'utf8' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return {
      ok: false,
      message: 'Le partage de fichiers n’est pas disponible sur cet appareil.',
    };
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Exporter les dépenses',
    UTI: 'public.comma-separated-values-text',
  });

  return { ok: true };
}
