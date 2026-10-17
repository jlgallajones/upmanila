import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeModeProvider, useThemeMode } from "@/theme/theme-mode";

function AppStack() {
  const { isDark } = useThemeMode();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms-and-conditions" />

        <Stack.Screen
          name="(tabs)"
          options={{ animation: "fade" }}
        />

        <Stack.Screen
          name="casualty/[id]"
          options={{
            animation: "slide_from_right",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeModeProvider>
      <AppStack />
    </ThemeModeProvider>
  );
}
