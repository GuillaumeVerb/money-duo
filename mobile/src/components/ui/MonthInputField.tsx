import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { InputField } from './InputField';
import {
  colors,
  fontSize,
  fontWeight,
  hairline,
  radius,
  spacing,
} from '../../theme/tokens';

type Props = {
  label?: string;
  value: string; // YYYY-MM
  onChangeText: (value: string) => void;
  placeholder?: string;
};

function parseMonthKey (v: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    return null;
  }
  return new Date(y, mo - 1, 1, 12, 0, 0, 0);
}

function toMonthKey (d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthInputField ({
  label,
  value,
  onChangeText,
  placeholder = 'AAAA-MM',
}: Props) {
  const selected = parseMonthKey(value) ?? new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(selected.getFullYear());

  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Date(2026, i, 1).toLocaleDateString('fr-FR', { month: 'short' })
      ),
    []
  );

  return (
    <>
      <View style={styles.wrap}>
        <InputField
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={false}
        />
        <Pressable
          style={styles.calendarBtn}
          onPress={() => {
            setYear(selected.getFullYear());
            setOpen(true);
          }}
          hitSlop={8}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={styles.head}>
              <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.yearTxt}>{year}</Text>
              <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {monthNames.map((name, idx) => {
                const d = new Date(year, idx, 1, 12, 0, 0, 0);
                const key = toMonthKey(d);
                const isOn = key === value;
                return (
                  <Pressable
                    key={key}
                    style={[styles.monthChip, isOn && styles.monthChipOn]}
                    onPress={() => {
                      onChangeText(key);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.monthTxt, isOn && styles.monthTxtOn]}>
                      {name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.footer}>
              <Pressable
                onPress={() => {
                  onChangeText(toMonthKey(new Date()));
                  setOpen(false);
                }}
              >
                <Text style={styles.footerBtn}>Ce mois</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  onChangeText('');
                  setOpen(false);
                }}
              >
                <Text style={styles.footerBtn}>Effacer</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  calendarBtn: {
    position: 'absolute',
    right: spacing.sm,
    top: 36,
    padding: spacing.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: hairline,
    borderColor: colors.borderLight,
    padding: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  yearTxt: {
    fontSize: fontSize.titleSm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  monthChip: {
    width: '30%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: hairline,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  monthChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  monthTxt: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  monthTxtOn: {
    color: colors.primaryDark,
    fontWeight: fontWeight.medium,
  },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerBtn: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
