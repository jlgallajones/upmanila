import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { Colors } from "@/constants/theme";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "dcms.mobile.themeMode";

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
