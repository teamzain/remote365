import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleProp, ViewStyle } from 'react-native';

/**
 * True when the user asked the OS to suppress motion (iOS Reduce Motion,
 * Android "Remove animations").
 */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (alive) setReduced(value); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => setReduced(value));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

/**
 * Fades + slides its children up on mount. Because each page's content unmounts
 * and remounts when you navigate to it, wrapping a page's content in this makes
 * the content animate in every time the page is shown.
 */
export function FadeInView({
  children,
  style,
  delay = 0,
  offset = 16,
  duration = 380,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  delay?: number;
  offset?: number;
  duration?: number;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      // Show the content immediately: the slide-and-fade is exactly the motion
      // class the OS setting exists to suppress.
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    let settled = false;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(() => { settled = true; });
    // Fail-open: a dropped native-driver animation must never strand the page
    // at opacity 0 (seen on release builds — same hazard ChatEmpty documents).
    const failSafe = setTimeout(() => {
      if (!settled) progress.setValue(1);
    }, delay + duration + 250);
    return () => {
      clearTimeout(failSafe);
      animation.stop();
    };
  }, [progress, delay, duration, reducedMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
