/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useThemeMode } from '@/theme/theme-mode';

export function useTheme() {
  return useThemeMode().colors;
}
