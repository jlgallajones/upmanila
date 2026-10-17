/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#6B6B6B',
    background: '#FAFAFA',
    backgroundElement: '#F2F2F2',
    backgroundSelected: '#E6E6E6',
    textSecondary: '#6B6B6B',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    border: '#E6E6E6',
    primary: '#00838F',
    primaryDark: '#005B63',
    primarySoft: '#E0F7FA',
    selectedBackground: '#E0F7FA',
    selectedBorder: '#00838F',
    tabBarBackground: '#00838F',
    tabBarActiveBackground: '#FFFFFF',
    tabBarActiveIcon: '#242424',
    tabBarInactiveIcon: '#FFFFFF',
    danger: '#D73333',
    warningBackground: '#FFF5F5',
    warningBorder: '#FFB7B7',
  },
  dark: {
    text: '#ffffff',
    background: '#6B6B6B',
    backgroundElement: '#242424',
    backgroundSelected: '#3A3A3A',
    textSecondary: '#E6E6E6',
    surface: '#242424',
    surfaceRaised: '#3A3A3A',
    border: '#3A3A3A',
    primary: '#23C8D5',
    primaryDark: '#00838F',
    primarySoft: 'rgba(35, 200, 213, 0.18)',
    selectedBackground: 'rgba(35, 200, 213, 0.24)',
    selectedBorder: '#23C8D5',
    tabBarBackground: '#006873',
    tabBarActiveBackground: '#FFFFFF',
    tabBarActiveIcon: '#6B6B6B',
    tabBarInactiveIcon: '#FFFFFF',
    danger: '#FF7B7B',
    warningBackground: 'rgba(255, 123, 123, 0.14)',
    warningBorder: 'rgba(255, 123, 123, 0.42)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-body)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-display)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
