import { formatMoney } from './format';
import type { ExpenseType } from './types';

const TYPE_LABEL: Record<ExpenseType, string> = {
  shared: 'Commun',
  personal: 'Perso',
  child: 'Enfant',
  home: 'Maison',
};

export function buildMonthRecapShareText (opts: {
  monthLabel: string;
  currency: string;
  spent: number;
  count: number;
  topCats: { name: string; total: number }[];
  byType: Record<ExpenseType, number>;
}): string {
  const lines: string[] = [
    `Money Duo — ${opts.monthLabel}`,
    `Total : ${formatMoney (opts.spent, opts.currency)}`,
    `${opts.count} mouvement${opts.count > 1 ? 's' : ''}`,
    '',
    ...opts.topCats
      .slice (0, 6)
      .map ((c) => `${c.name} : ${formatMoney (c.total, opts.currency)}`),
  ];
  const typeLines = (
    ['shared', 'personal', 'child', 'home'] as ExpenseType[]
  )
    .filter ((k) => opts.byType[k] > 0)
    .map (
      (k) => `${TYPE_LABEL[k]} : ${formatMoney (opts.byType[k], opts.currency)}`
    );
  if (typeLines.length) {
    lines.push ('', ...typeLines);
  }
  return lines.join ('\n');
}
