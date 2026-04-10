import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radius, spacing } from '../theme/tokens';

export type ToastVariant = 'success' | 'neutral' | 'danger';

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const VARIANT_BG: Record<ToastVariant, string> = {
  success: colors.successSoft,
  neutral: colors.surface,
  danger: colors.dangerSoft,
};

const VARIANT_BORDER: Record<ToastVariant, string> = {
  success: colors.borderLight,
  neutral: colors.borderLight,
  danger: colors.borderLight,
};

const VARIANT_TEXT: Record<ToastVariant, string> = {
  success: colors.text,
  neutral: colors.text,
  danger: colors.text,
};

export function ToastProvider ({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<ToastVariant>('neutral');
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setMessage(null));
  }, [opacity]);

  const showToast = useCallback(
    (msg: string, v: ToastVariant = 'neutral') => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      setVariant(v);
      setMessage(msg);
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(() => {
        hide();
      }, 2800);
    },
    [hide, opacity]
  );

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.wrap,
            {
              paddingBottom: Math.max(insets.bottom, spacing.md),
              opacity,
            },
          ]}
        >
          <Pressable
            onPress={() => hide()}
            style={[
              styles.banner,
              {
                backgroundColor: VARIANT_BG[variant],
                borderColor: VARIANT_BORDER[variant],
              },
            ]}
          >
            <Text style={[styles.text, { color: VARIANT_TEXT[variant] }]}>
              {message}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast () {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  banner: {
    maxWidth: 400,
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  text: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
    lineHeight: 20,
  },
});
