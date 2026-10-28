import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "dcms.mobile.themePreference";

type ThemeModeContextValue = {
  colors: typeof Colors.light | typeof Colors.dark;
  isDark: boolean;
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function resolveTheme(
  mode: ThemeMode,
  systemScheme: "light" | "dark" | "unspecified" | null | undefined,
): ResolvedTheme {
  if (mode === "system") {
    return systemScheme === "dark" ? "dark" : "light";
  }

  return mode;
}

export function ThemeModeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let isMounted = true;

    async function loadThemeMode() {
      const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);

      if (
        isMounted &&
        (savedMode === "system" ||
          savedMode === "light" ||
          savedMode === "dark")
      ) {
        setModeState(savedMode);
      }
    }

    void loadThemeMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
  };

  const resolvedTheme = resolveTheme(mode, systemScheme);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const themeColors = Colors[resolvedTheme];
    const variables: Record<string, string> = {
      background: themeColors.background,
      backgroundElement: themeColors.backgroundElement,
      backgroundSelected: themeColors.backgroundSelected,
      surface: themeColors.surface,
      surfaceRaised: themeColors.surfaceRaised,
      border: themeColors.border,
      text: themeColors.text,
      textSecondary: themeColors.textSecondary,
      primary: themeColors.primary,
      primaryDark: themeColors.primaryDark,
      primarySoft: themeColors.primarySoft,
      selectedBackground: themeColors.selectedBackground,
      selectedBorder: themeColors.selectedBorder,
      tabBarBackground: themeColors.tabBarBackground,
      tabBarActiveBackground: themeColors.tabBarActiveBackground,
      tabBarActiveIcon: themeColors.tabBarActiveIcon,
      tabBarInactiveIcon: themeColors.tabBarInactiveIcon,
      danger: themeColors.danger,
      warningBackground: themeColors.warningBackground,
      warningBorder: themeColors.warningBorder,
      blueBackground: themeColors.primarySoft,
      white: "#FFFFFF",
      card: themeColors.surface,
      fieldBackground: themeColors.backgroundElement,
      fieldBorder: themeColors.border,
      iconBackground: themeColors.backgroundElement,
      mutedText: themeColors.textSecondary,
      secondaryText: themeColors.textSecondary,
      maroon: resolvedTheme === "dark" ? themeColors.primaryDark : "#6B6B6B",
      blackButton: "#000000",
      black: themeColors.textSecondary,
      charcoal: themeColors.surfaceRaised,
      darkCyan: themeColors.primaryDark,
      darkMaroon: themeColors.textSecondary,
      gray: themeColors.textSecondary,
      grayBackground: themeColors.backgroundElement,
      teal: themeColors.primary,
      cyan: themeColors.primary,
      red: themeColors.danger,
      orange: resolvedTheme === "dark" ? "#FFB86C" : "#D96D12",
      blue: resolvedTheme === "dark" ? "#8FC5FF" : "#1976D2",
      green: resolvedTheme === "dark" ? "#74D99B" : "#388E3C",
      paleRed: themeColors.warningBackground,
      paleOrange: resolvedTheme === "dark" ? "rgba(255, 184, 108, 0.14)" : "#FFF8D9",
      paleBlue: themeColors.primarySoft,
      paleGreen: resolvedTheme === "dark" ? "rgba(116, 217, 155, 0.14)" : "#E8F4EA",
      paleCyan: themeColors.primarySoft,
      paleGray: themeColors.backgroundElement,
      greenBackground: resolvedTheme === "dark" ? "rgba(116, 217, 155, 0.14)" : "#ECFAF1",
      greenDark: themeColors.textSecondary,
      lightMaroon: themeColors.surfaceRaised,
      muted: themeColors.textSecondary,
      mutedWhite: "rgba(255,255,255,0.78)",
      orangeBorder: resolvedTheme === "dark" ? "rgba(255, 184, 108, 0.42)" : "#F4C3C5",
      primaryText: themeColors.text,
      redBackground: themeColors.warningBackground,
      orangeBackground: resolvedTheme === "dark" ? "rgba(255, 184, 108, 0.14)" : "#FFF4E7",
      secondary: themeColors.textSecondary,
      softWhite: themeColors.surface,
      warningText: themeColors.danger,
      synced: resolvedTheme === "dark" ? "#74D99B" : "#28B463",
      pending: resolvedTheme === "dark" ? "#FFB86C" : "#F0A000",
    };

    root.dataset.theme = resolvedTheme;

    for (const [key, value] of Object.entries(variables)) {
      root.style.setProperty(`--mobile-${key}`, value);
    }

    const autofillStyle = document.createElement("style");
    autofillStyle.dataset.mobileThemeAutofill = "true";
    autofillStyle.textContent = `
      :root[data-theme="dark"] input:-webkit-autofill,
      :root[data-theme="dark"] input:-webkit-autofill:hover,
      :root[data-theme="dark"] input:-webkit-autofill:focus,
      :root[data-theme="dark"] input:-webkit-autofill:active {
        background-color: var(--mobile-surface) !important;
        -webkit-box-shadow: 0 0 0 1000px var(--mobile-surface) inset !important;
        -webkit-text-fill-color: var(--mobile-text) !important;
        caret-color: var(--mobile-text) !important;
      }

      :root[data-theme="light"] input:-webkit-autofill,
      :root[data-theme="light"] input:-webkit-autofill:hover,
      :root[data-theme="light"] input:-webkit-autofill:focus,
      :root[data-theme="light"] input:-webkit-autofill:active {
        background-color: var(--mobile-surface) !important;
        -webkit-box-shadow: 0 0 0 1000px var(--mobile-surface) inset !important;
        -webkit-text-fill-color: var(--mobile-text) !important;
        caret-color: var(--mobile-text) !important;
      }
    `;
    document.head.appendChild(autofillStyle);

    return () => {
      autofillStyle.remove();
      root.removeAttribute("data-theme");

      for (const key of Object.keys(variables)) {
        root.style.removeProperty(`--mobile-${key}`);
      }
    };
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({
      colors: Colors[resolvedTheme],
      isDark,
      mode,
      resolvedTheme,
      setMode,
      toggleTheme: () => setMode(isDark ? "light" : "dark"),
    }),
    [isDark, mode, resolvedTheme],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode() {
  const value = useContext(ThemeModeContext);

  if (!value) {
    throw new Error("useThemeMode must be used inside ThemeModeProvider.");
  }

  return value;
}
