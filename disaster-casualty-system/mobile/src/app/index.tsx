import { router } from "expo-router";
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

const medsortLogoBase = require("../../assets/images/medsort-login-base.png");
const medsortBallYellow = require("../../assets/images/medsort-ball-yellow.png");
const medsortBallGreen = require("../../assets/images/medsort-ball-green.png");
const medsortBallRed = require("../../assets/images/medsort-ball-red.png");
const upLogo = require("../assets/UP-Logo.svg");
const upmDrrmhLogo = require("../assets/UPM DRRMH Logo.png");
const dostLogo = require("../assets/DOST Logo.png");
const dostPchrdLogo = require("../assets/DOST PCHRD Logo.png");

const LOGO_SIZE = 148;
const BALL_SIZE = LOGO_SIZE * 0.19;
const RED_BALL_SIZE = BALL_SIZE - 2;
const BALL_INSET = 10;
const BALL_TRAVEL = 64;
const RED_BALL_TRAVEL = 50;

const COLORS = {
  cyan: "#00838F",
  darkCyan: "#005B63",
  paleCyan: "#E0F7FA",
  white: "#FFFFFF",
  softWhite: "#F7FFFF",
  mutedWhite: "rgba(255, 255, 255, 0.78)",
};

export default function LandingScreen() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const yellowBounce = useRef(new Animated.Value(0)).current;
  const redBounce = useRef(new Animated.Value(0)).current;

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
        Animated.parallel([
          Animated.timing(yellowBounce, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(redBounce, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(yellowBounce, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(redBounce, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [redBounce, yellowBounce]);

  if (isCheckingSession) {
    return null;
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.cyan}
      />

      <SafeAreaView style={styles.safeArea}>
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
              source={medsortBallYellow}
              style={[
                styles.logoBall,
                styles.logoBallYellow,
                {
                  transform: [
                    {
                      translateY: yellowBounce.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-BALL_TRAVEL, 0],
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="cover"
            />

            <Animated.Image
              source={medsortBallGreen}
              style={[styles.logoBall, styles.logoBallGreen]}
              resizeMode="cover"
            />

            <Animated.Image
              source={medsortBallRed}
              style={[
                styles.logoBall,
                styles.logoBallRed,
                {
                  transform: [
                    {
                      translateX: redBounce.interpolate({
                        inputRange: [0, 1],
                        outputRange: [RED_BALL_TRAVEL, 0],
                      }),
                    },
                  ],
                },
              ]}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.kicker}>Emergency Response</Text>
          <Text style={styles.title}>MedSORT</Text>
          <Text style={styles.subtitle}>
            Disaster casualty management and triage support for
            authorized responders.
          </Text>
        </View>

        <View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/login")}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
    backgroundColor: COLORS.white,
    marginBottom: 34,
    shadowColor: "#000000",
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
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: 999,
    zIndex: 3,
  },
  logoBallGreen: {
    left: BALL_INSET - 1,
    bottom: BALL_INSET - 1,
    zIndex: 4,
  },
  logoBallYellow: {
    left: BALL_INSET - 4,
    bottom: BALL_INSET + BALL_SIZE + 5,
  },
  logoBallRed: {
    left: BALL_INSET + BALL_SIZE + 8,
    bottom: BALL_INSET - 9,
    width: RED_BALL_SIZE,
    height: RED_BALL_SIZE,
  },
  kicker: {
    color: COLORS.mutedWhite,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: "uppercase",
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
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    shadowColor: "#000000",
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
