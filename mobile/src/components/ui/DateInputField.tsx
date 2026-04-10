import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
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
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  dense?: boolean;
  containerStyle?: ViewStyle;
  clearable?: boolean;
};

function toYmd (d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYmd (value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function DateInputField ({
  label,
  value,
  onChangeText,
  placeholder = 'AAAA-MM-JJ',
  hint,
  dense,
  containerStyle,
  clearable = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseYmd(value);
  const [cursorMonth, setCursorMonth] = useState<Date>(() => {
    const base = selectedDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
  });

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('fr-FR', {
        month: 'long',
        year: 'numeric',
      }).format(cursorMonth),
    [cursorMonth]
  );

  const monthCells = useMemo(() => {
    const first = new Date(
      cursorMonth.getFullYear(),
      cursorMonth.getMonth(),
      1,
      12,
      0,
      0,
      0
    );
    const last = new Date(
      cursorMonth.getFullYear(),
      cursorMonth.getMonth() + 1,
      0,
      12,
      0,
      0,
      0
    );
    const leading = (first.getDay() + 6) % 7;
    const out: Array<Date | null> = [];
    for (let i = 0; i < leading; i++) {
      out.push(null);
    }
    for (let d = 1; d <= last.getDate(); d++) {
      out.push(
        new Date(
          cursorMonth.getFullYear(),
          cursorMonth.getMonth(),
          d,
          12,
          0,
          0,
          0
        )
      );
    }
    while (out.length % 7 !== 0) {
      out.push(null);
    }
    return out;
  }, [cursorMonth]);

  return (
    <>
      <View style={[styles.fieldWrap, containerStyle]}>
        <InputField
          label={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          hint={hint}
          dense={dense}
          editable={false}
        />
        <Pressable
          style={styles.calendarBtn}
          onPress={() => {
            const base = selectedDate ?? new Date();
            setCursorMonth(new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0));
            setOpen(true);
          }}
          hitSlop={8}
          accessibilityLabel="Ouvrir le calendrier"
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
              <Pressable
                onPress={() =>
                  setCursorMonth(
                    (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1, 12, 0, 0, 0)
                  )
                }
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color={colors.primary} />
              </Pressable>
              <Text style={styles.monthTitle}>{monthLabel}</Text>
              <Pressable
                onPress={() =>
                  setCursorMonth(
                    (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1, 12, 0, 0, 0)
                  )
                }
                hitSlop={8}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((w, idx) => (
                <Text key={w + String(idx)} style={styles.weekDay}>
                  {w}
                </Text>
              ))}
            </View>
            <View style={styles.grid}>
              {monthCells.map((d, idx) => {
                if (!d) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const ymd = toYmd(d);
                const selected = ymd === value;
                return (
                  <Pressable
                    key={ymd}
                    style={[styles.dayCell, selected && styles.dayCellOn]}
                    onPress={() => {
                      onChangeText(ymd);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.dayTxt, selected && styles.dayTxtOn]}>
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.footer}>
              {clearable ? (
                <Pressable
                  onPress={() => {
                    onChangeText('');
                    setOpen(false);
                  }}
                >
                  <Text style={styles.footerBtn}>Effacer</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => {
                  onChangeText(toYmd(new Date()));
                  setOpen(false);
                }}
              >
                <Text style={styles.footerBtn}>Aujourd'hui</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fieldWrap: {
    position: 'relative',
  },
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
  monthTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  dayCellOn: {
    backgroundColor: colors.primarySoft,
  },
  dayTxt: {
    fontSize: fontSize.small,
    color: colors.text,
  },
  dayTxtOn: {
    color: colors.primaryDark,
    fontWeight: fontWeight.semibold,
  },
  footer: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerBtn: {
    fontSize: fontSize.small,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
});
