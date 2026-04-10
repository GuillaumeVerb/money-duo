import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';

type Props = {
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
};

export function ProgressBar ({
  progress,
  height = 5,
  trackColor = colors.borderLight,
  fillColor = colors.primary,
}: Props) {
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${p * 100}%`,
            backgroundColor: fillColor,
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: radius.full,
  },
});
