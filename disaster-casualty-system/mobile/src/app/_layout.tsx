import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeModeProvider } from "@/theme/theme-mode";

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
      <StatusBar style="light" />

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
    </ThemeModeProvider>
  );
}
