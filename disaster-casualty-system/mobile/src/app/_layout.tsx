import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: {
            backgroundColor: "#7B1113",
          },
        }}
      >
        <Stack.Screen name="index" />

        <Stack.Screen
          name="login"
          options={{
            animation: "fade",
          }}
        />

        <Stack.Screen
          name="dashboard"
          options={{
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen
          name="incidents"
          options={{
            animation: "slide_from_right",
          }}
        />
      </Stack>
    </>
  );
}