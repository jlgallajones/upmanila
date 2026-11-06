import { router } from "expo-router";
import { createThemePalette } from "@/constants/theme";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getAccessToken,
  getCurrentUser,
} from "../auth/session";
import ThemeToggleButton from "../components/theme-toggle-button";
import { useThemeMode } from "../theme/theme-mode";

const medsortLogoBase = require("../../assets/images/medsort-login-base.png");
const medsortBallYellow = require("../../assets/images/medsort-ball-yellow.png");
const medsortBallGreen = require("../../assets/images/medsort-ball-green.png");
const medsortBallRed = require("../../assets/images/medsort-ball-red.png");
const upLogo = require("../assets/UP-Manila.png");
const upmDrrmhLogo = require("../assets/UPM DRRMH Logo.png");
const dostLogo = require("../assets/DOST Logo.png");
const dostPchrdLogo = require("../assets/DOST PCHRD Logo.png");

const LOGO_SIZE = 148;
const BALL_SIZE = LOGO_SIZE * 0.19;
const RED_BALL_SIZE = BALL_SIZE - 2;
const LOGO_ROLL_DURATION = 1800;
const LOGO_PATH_INPUT_YELLOW = [0, 0.745, 1];
const LOGO_PATH_INPUT_GREEN = [0, 0.461, 1];
const LOGO_PATH_INPUT_RED = [0, 0.177, 1];
const LOGO_PATH_X_YELLOW = [1, 1, 36];
const LOGO_PATH_Y_YELLOW = [7, 112, 112];
const LOGO_PATH_X_GREEN = [1, 1, 76];
const LOGO_PATH_Y_GREEN = [47, 112, 112];
const LOGO_PATH_X_RED = [1, 1, 116];
const LOGO_PATH_Y_RED = [87, 112, 112];

const COLORS = createThemePalette({
  cyan: "#00838F",
  darkCyan: "#005B63",
  paleCyan: "#E0F7FA",
  white: "#FFFFFF",
  softWhite: "#F7FFFF",
  mutedWhite: "rgba(255, 255, 255, 0.78)",
});

export default function LandingScreen() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const logoPathMotion = useRef(new Animated.Value(0)).current;
  const { colors, isDark } = useThemeMode();

  useEffect(() => {
    let isMounted = true;

    async function routeFromStoredSession() {
      const [user, token] = await Promise.all([
        getCurrentUser(),
        getAccessToken(),
      ]);

      if (!isMounted) {
        return;
      }

      if (user && token) {
        router.replace("/home");
        return;
      }

      setIsCheckingSession(false);
    }

    void routeFromStoredSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPathMotion, {
          toValue: 1,
          duration: LOGO_ROLL_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(logoPathMotion, {
          toValue: 0,
          duration: LOGO_ROLL_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [logoPathMotion]);

  if (isCheckingSession) {
    return null;
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: isDark ? colors.background : COLORS.cyan,
        },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={isDark ? colors.background : COLORS.cyan}
      />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.themeToggleSlot}>
          <ThemeToggleButton compact inverted />
        </View>

        <View style={styles.brandBlock}>
          <View style={styles.partnerLogoRow}>
            <ExpoImage
              source={upLogo}
              style={styles.sealLogo}
              contentFit="contain"
            />
            <ExpoImage
              source={upmDrrmhLogo}
              style={styles.sealLogo}
              contentFit="contain"
            />
            <ExpoImage
              source={dostLogo}
              style={styles.partnerLogo}
              contentFit="contain"
            />
            <ExpoImage
              source={dostPchrdLogo}
              style={styles.partnerLogo}
              contentFit="contain"
            />
          </View>

          <View style={styles.logoFrame}>
            <Animated.Image
              source={medsortLogoBase}
              style={styles.logoBase}
              resizeMode="contain"
            />

            <Animated.Image
              source={medsortBallRed}
              style={[
                styles.logoBall,
                styles.logoBallRed,
                {
                  transform: [
                    {
                      translateX: logoPathMotion.interpolate({
                        inputRange: LOGO_PATH_INPUT_RED,
                        outputRange: LOGO_PATH_X_RED,
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      translateY: logoPathMotion.interpolate({
                        inputRange: LOGO_PATH_INPUT_RED,
                        outputRange: LOGO_PATH_Y_RED,
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      rotate: logoPathMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="cover"
            />

            <Animated.Image
              source={medsortBallGreen}
              style={[
                styles.logoBall,
                styles.logoBallGreen,
                {
                  transform: [
                    {
                      translateX: logoPathMotion.interpolate({
                        inputRange: LOGO_PATH_INPUT_GREEN,
                        outputRange: LOGO_PATH_X_GREEN,
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      translateY: logoPathMotion.interpolate({
                        inputRange: LOGO_PATH_INPUT_GREEN,
                        outputRange: LOGO_PATH_Y_GREEN,
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      rotate: logoPathMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="cover"
            />

            <Animated.Image
              source={medsortBallYellow}
              style={[
                styles.logoBall,
                styles.logoBallYellow,
                {
                  transform: [
                    {
                      translateX: logoPathMotion.interpolate({
                        inputRange: LOGO_PATH_INPUT_YELLOW,
                        outputRange: LOGO_PATH_X_YELLOW,
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      translateY: logoPathMotion.interpolate({
                        inputRange: LOGO_PATH_INPUT_YELLOW,
                        outputRange: LOGO_PATH_Y_YELLOW,
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      rotate: logoPathMotion.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.kicker}>
            UNIVERSITY OF THE PHILIPPINES MANILA{"\n"}
            DISASTER RISK REDUCTION AND MANAGEMENT IN HEALTH
          </Text>
          <Text style={styles.title}>SCRIBER</Text>
          <Text style={styles.subtitle}>
            Standardized Casualty Reporting for Incidents and Basic Emergency Response
          </Text>
        </View>

        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/login")}
            style={({ pressed }) => [
              styles.continueButton,
              {
                backgroundColor: colors.surface,
              },
              pressed && styles.continueButtonPressed,
            ]}
          >
            <Text
              style={[
                styles.continueButtonText,
                {
                  color: colors.primary,
                },
              ]}
            >
              Continue
            </Text>
          </Pressable>

          <View style={styles.legalLinkRow}>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/privacy-policy")}
              hitSlop={10}
            >
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalSeparator}>|</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/terms-and-conditions")}
              hitSlop={10}
            >
              <Text style={styles.legalLinkText}>
                Terms & Conditions
              </Text>
            </Pressable>
            <Text style={styles.legalSeparator}>|</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push("/about-us" as never)}
              hitSlop={10}
            >
              <Text style={styles.legalLinkText}>About Us</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.cyan,
  },
  safeArea: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingBottom: 42,
    paddingTop: 30,
  },
  themeToggleSlot: {
    alignItems: "flex-end",
  },
  brandBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerLogoRow: {
    width: "100%",
    maxWidth: 330,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    marginBottom: 32,
  },
  sealLogo: {
    width: 48,
    height: 48,
  },
  partnerLogo: {
    width: 54,
    height: 48,
  },
  logoFrame: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 38,
    borderWidth: 5,
    borderColor: COLORS.white,
    backgroundColor: COLORS.surface,
    marginBottom: 34,
    shadowColor: "#6B6B6B",
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 8,
    overflow: "hidden",
  },
  logoBase: {
    position: "absolute",
    left: 0,
    top: 0,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 33,
    zIndex: 1,
  },
  logoBall: {
    position: "absolute",
    left: 0,
    top: 0,
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: 999,
    zIndex: 3,
  },
  logoBallGreen: {
    zIndex: 4,
  },
  logoBallYellow: {
  },
  logoBallRed: {
    width: RED_BALL_SIZE,
    height: RED_BALL_SIZE,
  },
  kicker: {
    color: COLORS.mutedWhite,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 18,
    marginBottom: 10,
    textAlign: "center",
    textTransform: "uppercase",
    width: "100%",
  },
  title: {
    color: COLORS.white,
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 58,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.mutedWhite,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
    maxWidth: 330,
    textAlign: "center",
  },
  continueButton: {
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 24,
    shadowColor: "#6B6B6B",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 7,
  },
  continueButtonPressed: {
    backgroundColor: COLORS.paleCyan,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    color: COLORS.darkCyan,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0,
  },
  legalLinkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 18,
  },
  legalLinkText: {
    color: COLORS.mutedWhite,
    fontSize: 12,
    fontWeight: "800",
  },
  legalSeparator: {
    color: COLORS.mutedWhite,
    fontSize: 12,
    fontWeight: "800",
  },
});
