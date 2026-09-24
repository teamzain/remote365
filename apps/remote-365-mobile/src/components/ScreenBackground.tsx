import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

/**
 * Soft orange gradient ellipses (the three "blobs" from the Connect design).
 * Rendered once, app-wide, behind every screen so every page shares the same
 * backdrop. Screen containers are transparent so this shows through.
 */
type BlobPosition = { top?: number; bottom?: number; left?: number; right?: number };

function Blob({
  id,
  size,
  position,
  strength,
}: {
  id: string;
  size: number;
  position: BlobPosition;
  strength: number;
}) {
  return (
    <View pointerEvents="none" style={[styles.blob, position, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FF8A00" stopOpacity={strength} />
            <Stop offset="55%" stopColor="#FFB347" stopOpacity={strength * 0.7} />
            <Stop offset="100%" stopColor="#FFB347" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function ScreenBackground() {
  const { width, height } = useWindowDimensions();

  // Sizes are capped, so the offsets must be derived from the (capped) size
  // rather than from the window width — otherwise, once the cap bites, the
  // offset keeps growing and the blob walks off the screen entirely (tablets,
  // foldable inner displays, landscape). Below the cap size === width * ratio,
  // so these are the same numbers as before.
  const topSize = Math.min(width * 0.81, 320);
  const midSize = Math.min(width * 0.79, 312);
  const bottomSize = Math.min(width * 0.89, 352);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Ellipse 1 — top-left */}
      <Blob
        id="screenGlowTop"
        size={topSize}
        position={{ top: 10, left: -topSize * (0.3 / 0.81) }}
        strength={0.3}
      />
      {/* Ellipse 2 — mid-right */}
      <Blob
        id="screenGlowMid"
        size={midSize}
        position={{ top: height * 0.34, right: -midSize * (0.42 / 0.79) }}
        strength={0.2}
      />
      {/* Ellipse 3 — bottom-left */}
      <Blob
        id="screenGlowBottom"
        size={bottomSize}
        position={{ bottom: -bottomSize * (0.42 / 0.89), left: -bottomSize * (0.11 / 0.89) }}
        strength={0.3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
