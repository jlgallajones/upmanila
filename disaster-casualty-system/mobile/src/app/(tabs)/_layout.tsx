import { Ionicons } from "@expo/vector-icons";
import { router, Tabs, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, StyleSheet, View, type ColorValue } from "react-native";

import {
  getAccessToken,
  getCurrentUser,
} from "../../auth/session";
import { useThemeMode } from "../../theme/theme-mode";

function TabIcon({
  color,
  focused,
  icon,
  activeIcon,
  activeIconColor,
  activeBackgroundColor,
  size = 26,
}: {
  color: ColorValue;
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  activeIconColor: string;
  activeBackgroundColor: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.tabIconShell,
        focused && {
          backgroundColor: activeBackgroundColor,
        },
      ]}
    >
      <Ionicons
        name={focused ? activeIcon : icon}
        size={size}
        color={focused ? activeIconColor : color}
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
  const { colors } = useThemeMode();

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
        tabBarActiveTintColor: colors.tabBarInactiveIcon,
        tabBarInactiveTintColor: colors.tabBarInactiveIcon,
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
          height: 50,
          paddingTop: 0,
          paddingBottom: 0,
          borderTopWidth: 1,
          borderTopColor: "transparent",
          borderColor: colors.selectedBorder,
          borderWidth: 1,
          borderRadius: 999,
          backgroundColor: colors.tabBarBackground,
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
          height: 50,
          alignItems: "center",
          justifyContent: "center",
        },
        tabBarIconStyle: {
          alignItems: "center",
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
              activeIconColor={colors.tabBarActiveIcon}
              activeBackgroundColor={colors.tabBarActiveBackground}
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
              activeIconColor={colors.tabBarActiveIcon}
              activeBackgroundColor={colors.tabBarActiveBackground}
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
              activeIconColor={colors.tabBarActiveIcon}
              activeBackgroundColor={colors.tabBarActiveBackground}
              size={29}
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
              activeIconColor={colors.tabBarActiveIcon}
              activeBackgroundColor={colors.tabBarActiveBackground}
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
              activeIconColor={colors.tabBarActiveIcon}
              activeBackgroundColor={colors.tabBarActiveBackground}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconShell: {
    width: 52,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
