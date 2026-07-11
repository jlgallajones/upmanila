import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
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

import EmergencyShield from "../components/common/EmergencyShield";

const COLORS = {
  upMaroon: "#7B1113",
  deepMaroon: "#4A0709",
  brightMaroon: "#971B1E",
  upGreen: "#014421",
  gold: "#FDBB30",
  white: "#FFFFFF",
  mutedWhite: "rgba(255, 255, 255, 0.72)",
  faintWhite: "rgba(255, 255, 255, 0.15)",
};

export default function LandingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const hasNavigated = useRef(false);

  function continueToLogin() {
    if (hasNavigated.current) {
      return;
    }

    hasNavigated.current = true;
    router.replace("/login");
  }

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulseAnimation.start();

    return () => {
  pulseAnimation.stop();
};
  }, [entrance, pulse]);

  const contentTranslateY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [24, 0],
  });

  const outerRingScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.35],
  });

  const middleRingScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.18],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0.42, 0.24, 0],
  });

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.upMaroon}
      />

      <View style={styles.topCircle} />
      <View style={styles.bottomCircle} />
      <View style={styles.centerGlow} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: entrance,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          <View style={styles.brandSection}>
            <Image
              source={require("../assets/UP-Logo.svg")}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="University of the Philippines logo"
            />

            <View style={styles.institutionRow}>
              <View style={styles.verticalLine} />

              <View style={styles.institutionTextWrapper}>
                <Text style={styles.republicText}>
                  REPUBLIC OF THE PHILIPPINES
                </Text>

                <Text style={styles.institutionText}>
                  UNIVERSITY OF THE PHILIPPINES
                </Text>
              </View>

              <View style={styles.verticalLine} />
            </View>
          </View>

          <View style={styles.emblemSection}>
            <View style={styles.pulseContainer}>
              <Animated.View
                style={[
                  styles.outerPulse,
                  {
                    opacity: ringOpacity,
                    transform: [{ scale: outerRingScale }],
                  },
                ]}
              />

              <Animated.View
                style={[
                  styles.middlePulse,
                  {
                    opacity: ringOpacity,
                    transform: [{ scale: middleRingScale }],
                  },
                ]}
              />

              <View style={styles.innerRing}>
                <View style={styles.shieldContainer}>
                  <EmergencyShield size={102} />
                </View>
              </View>
            </View>

            <View style={styles.acronymBadge}>
              <Text style={styles.acronym}>DCMS</Text>
            </View>
          </View>

          <View style={styles.titleSection}>
            <Text style={styles.title}>
              Disaster Casualty{"\n"}Management System
            </Text>

            <Text style={styles.subtitle}>
              Emergency Response Information Platform
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
            ]}
            onPress={continueToLogin}
            accessibilityRole="button"
            accessibilityLabel="Continue to login"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </Pressable>

          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <View style={styles.upBadge}>
              <Text style={styles.upBadgeText}>UP</Text>
            </View>

            <Text style={styles.footerText}>
              University of the Philippines
            </Text>

            <View style={styles.footerLine} />
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: COLORS.upMaroon,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 22,
  },

  topCircle: {
    position: "absolute",
    top: -130,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(255, 255, 255, 0.035)",
  },
  bottomCircle: {
    position: "absolute",
    bottom: -180,
    left: -180,
    width: 410,
    height: 410,
    borderRadius: 205,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  centerGlow: {
    position: "absolute",
    top: "30%",
    left: "8%",
    right: "8%",
    height: 440,
    borderRadius: 220,
    backgroundColor: "rgba(255, 255, 255, 0.025)",
  },

  brandSection: {
    alignItems: "center",
    width: "100%",
  },
  logo: {
    width: 112,
    height: 112,
    marginBottom: 20,
  },
  institutionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  institutionTextWrapper: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  verticalLine: {
    width: 1,
    height: 46,
    backgroundColor: "rgba(255, 255, 255, 0.58)",
  },
  republicText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 3.2,
    textAlign: "center",
  },
  institutionText: {
    color: COLORS.mutedWhite,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 2.1,
    lineHeight: 20,
    marginTop: 12,
    textAlign: "center",
  },

  emblemSection: {
    alignItems: "center",
    marginTop: 40,
  },
  pulseContainer: {
    width: 230,
    height: 230,
    alignItems: "center",
    justifyContent: "center",
  },
  outerPulse: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  middlePulse: {
    position: "absolute",
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  innerRing: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.47)",
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.white,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 12,
  },
  shieldContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  acronymBadge: {
    minWidth: 110,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    marginTop: 12,
  },
  acronym: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 5,
    textAlign: "center",
  },

  titleSection: {
    alignItems: "center",
    marginTop: 26,
  },
  title: {
    color: COLORS.white,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.mutedWhite,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 14,
  },

  continueButton: {
    minWidth: 156,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    backgroundColor: COLORS.upGreen,
    borderWidth: 1,
    borderColor: "rgba(253, 187, 48, 0.75)",
  },
  continueButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  footer: {
    marginTop: "auto",
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  footerLine: {
    flex: 1,
    height: 1,
    maxWidth: 70,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  upBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 16,
    marginRight: 12,
    backgroundColor: COLORS.upGreen,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  upBadgeText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  footerText: {
    color: COLORS.mutedWhite,
    fontSize: 13,
    marginRight: 16,
  },
});