import { Ionicons } from "@expo/vector-icons";
import { router, Tabs, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View, type ColorValue } from "react-native";

import {
  getAccessToken,
  getCurrentUser,
} from "../../auth/session";

const COLORS = {
  teal: "#00838F",
  inactive: "#FFFFFF",
  activeIcon: "#242424",
  white: "#FFFFFF",
  border: "#E6E6E6",
};

function TabIcon({
  color,
  focused,
  icon,
  activeIcon,
  size = 24,
}: {
  color: ColorValue;
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  size?: number;
}) {
  return (
    <View style={[styles.tabIconShell, focused && styles.tabIconShellActive]}>
      <Ionicons
        name={focused ? activeIcon : icon}
        size={size}
        color={focused ? COLORS.activeIcon : color}
      />
    </View>
  );
}

export default function TabLayout() {
  const [isSuperAdmin, setIsSuperAdmin] =
    useState(false);
  const [isCheckingSession, setIsCheckingSession] =
    useState(true);
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function requireSession() {
        const [user, token] = await Promise.all([
          getCurrentUser(),
          getAccessToken(),
        ]);

        if (!isMounted) {
          return;
        }

        const hasSession = Boolean(user && token);

        setIsAuthenticated(hasSession);
        setIsSuperAdmin(user?.role === "super_admin");
        setIsCheckingSession(false);

        if (!hasSession) {
          router.replace("/login");
        }
      }

      void requireSession();

      return () => {
        isMounted = false;
      };
    }, []),
  );

  if (isCheckingSession || !isAuthenticated) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.white,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarShowLabel: false,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Platform.OS === "android" ? 14 : 22,
          height: 38,
          paddingTop: 0,
          paddingBottom: 0,
          borderTopWidth: 1,
          borderTopColor: "transparent",
          borderColor: COLORS.border,
          borderWidth: 1,
          borderRadius: 999,
          backgroundColor: COLORS.teal,
          overflow: "hidden",
          elevation: 10,
          shadowColor: "#000000",
          shadowOpacity: 0.12,
          shadowRadius: 12,
          shadowOffset: {
            width: 0,
            height: 5,
          },
        },
        tabBarItemStyle: {
          height: 38,
          justifyContent: "center",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              icon="home-outline"
              activeIcon="home"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="records"
        options={{
          title: "Records",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              icon="folder-outline"
              activeIcon="folder"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="add-casualty"
        options={{
          href: isSuperAdmin ? null : undefined,
          title: "Add",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              icon="add-circle-outline"
              activeIcon="add-circle"
              size={25}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="drafts"
        options={{
          href: isSuperAdmin ? null : undefined,
          title: "Drafts",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              icon="document-text-outline"
              activeIcon="document-text"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              icon="person-outline"
              activeIcon="person"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconShell: {
    width: 62,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconShellActive: {
    backgroundColor: COLORS.white,
  },
});
