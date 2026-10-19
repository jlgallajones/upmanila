/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#3A3A3A',
    background: '#FAFAFA',
    backgroundElement: '#F2F2F2',
    backgroundSelected: '#E6E6E6',
    textSecondary: '#3A3A3A',
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
    text: '#F2F4F5',
    background: '#232629',
    backgroundElement: '#2B3034',
    backgroundSelected: '#343A40',
    textSecondary: '#B7C0C8',
    surface: '#2B3034',
    surfaceRaised: '#343A40',
    border: '#465057',
    primary: '#23C8D5',
    primaryDark: '#007B86',
    primarySoft: 'rgba(35, 200, 213, 0.16)',
    selectedBackground: 'rgba(35, 200, 213, 0.20)',
    selectedBorder: '#23C8D5',
    tabBarBackground: '#006D78',
    tabBarActiveBackground: '#F2F4F5',
    tabBarActiveIcon: '#6B6B6B',
    tabBarInactiveIcon: '#F2F4F5',
    danger: '#F27C85',
    warningBackground: 'rgba(242, 124, 133, 0.14)',
    warningBorder: 'rgba(242, 124, 133, 0.42)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

type ThemePaletteAliases = {
  background: string;
  card: string;
  fieldBackground: string;
  fieldBorder: string;
  greenBackground: string;
  orangeBackground: string;
  primary: string;
  surface: string;
  text: string;
  warningBackground: string;
  warningBorder: string;
};

export function createThemePalette<T extends Record<string, string>>(
  palette: T,
): T & ThemePaletteAliases {
  if (Platform.OS !== 'web') {
    const nativePalette = palette as Record<string, string>;

    return {
      ...palette,
      background:
        nativePalette.background ??
        nativePalette.surface ??
        nativePalette.white,
      card: nativePalette.card ?? nativePalette.surface ?? nativePalette.white,
      fieldBackground:
        nativePalette.fieldBackground ??
        nativePalette.background ??
        nativePalette.white,
      fieldBorder: nativePalette.fieldBorder ?? nativePalette.border ?? "#E6E6E6",
      greenBackground:
        nativePalette.greenBackground ??
        nativePalette.paleGreen ??
        nativePalette.background ??
        nativePalette.white,
      orangeBackground:
        nativePalette.orangeBackground ??
        nativePalette.paleOrange ??
        nativePalette.background ??
        nativePalette.white,
      primary:
        nativePalette.primary ??
        nativePalette.cyan ??
        nativePalette.teal ??
        nativePalette.maroon ??
        nativePalette.text,
      surface:
        nativePalette.surface ??
        nativePalette.card ??
        nativePalette.background ??
        nativePalette.white,
      text:
        nativePalette.text ??
        nativePalette.primaryText ??
        nativePalette.secondaryText ??
        nativePalette.white,
      warningBackground:
        nativePalette.warningBackground ??
        nativePalette.paleRed ??
        nativePalette.background ??
        nativePalette.white,
      warningBorder:
        nativePalette.warningBorder ??
        nativePalette.orangeBorder ??
        nativePalette.fieldBorder ??
        "#E6E6E6",
    } as T & ThemePaletteAliases;
  }

  return Object.fromEntries([
    ...Object.entries(palette).map(([key, value]) => [
      key,
      `var(--mobile-${key}, ${value})`,
    ]),
    ["background", "var(--mobile-background, #FAFAFA)"],
    ["card", "var(--mobile-surface, #FFFFFF)"],
    ["fieldBackground", "var(--mobile-fieldBackground, #F7F9FC)"],
    ["fieldBorder", "var(--mobile-fieldBorder, #D9E0EA)"],
    ["greenBackground", "var(--mobile-greenBackground, #E8F4EA)"],
    ["orangeBackground", "var(--mobile-orangeBackground, #FFF4E7)"],
    ["primary", "var(--mobile-primary, #00838F)"],
    ["surface", "var(--mobile-surface, #FFFFFF)"],
    ["text", "var(--mobile-text, #3A3A3A)"],
    ["warningBackground", "var(--mobile-warningBackground, #FFF5F5)"],
    ["warningBorder", "var(--mobile-warningBorder, #FFB7B7)"],
  ]) as T & ThemePaletteAliases;
}

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
