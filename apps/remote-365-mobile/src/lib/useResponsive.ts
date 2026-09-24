import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getResponsiveLayout } from './responsive';

export function useResponsive() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return { ...getResponsiveLayout(width, height, fontScale, insets), width, height, fontScale, insets };
}
