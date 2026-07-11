import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import EmergencyShield from "../../components/common/EmergencyShield";

const COLORS = {
  maroon: "#7B1113",
  darkMaroon: "#630C0E",
  lightMaroon: "#9B2427",
  white: "#FFFFFF",
  background: "#FFFFFF",
  fieldBackground: "#F6F8FB",
  fieldBorder: "#D7DFEB",
  primaryText: "#15213A",
  secondaryText: "#536078",
  mutedText: "#8A97AE",
  warningBackground: "#FFF5F5",
  warningBorder: "#FFB7B7",
  warningText: "#D32626",
};

export default function LoginScreen() {
  const [email, setEmail] = useState("responder@ndrrmc.gov.ph");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert(
        "Incomplete credentials",
        "Please enter your email address and password.",
      );
      return;
    }

    try {
      setIsSubmitting(true);

      /*
       * Temporary navigation.
       * Replace this with the real Supabase login later.
       */
      router.replace("/home");
    } catch {
      Alert.alert(
        "Login failed",
        "Unable to sign in. Please check your credentials.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleForgotPassword() {
    Alert.alert(
      "Forgot password",
      "Password recovery will be connected to Supabase Auth later.",
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.maroon}
      />

      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View style={styles.headerCircleLarge} />
          <View style={styles.headerCircleSmall} />

          <View style={styles.headerContent}>
            <View style={styles.iconBox}>
              <EmergencyShield size={44} />
            </View>

            <View style={styles.headerTextWrapper}>
              <Text style={styles.portalText}>
                NDRRMC · DCMS PORTAL
              </Text>

              <Text style={styles.headerTitle}>
                Emergency Responder{"\n"}Login
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.description}>
            Sign in with your official responder credentials to
            access the casualty management system.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="mail-outline"
                size={19}
                color={COLORS.mutedText}
              />

              <TextInput
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                placeholder="responder@ndrrmc.gov.ph"
                placeholderTextColor={COLORS.mutedText}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>PASSWORD</Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color={COLORS.mutedText}
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.mutedText}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <Pressable
                onPress={() => setShowPassword((current) => !current)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-outline"
                      : "eye-off-outline"
                  }
                  size={20}
                  color={COLORS.mutedText}
                />
              </Pressable>
            </View>

            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberButton}
                onPress={() => setRememberMe((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
              >
                <View
                  style={[
                    styles.checkbox,
                    rememberMe && styles.checkboxChecked,
                  ]}
                >
                  {rememberMe ? (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={COLORS.white}
                    />
                  ) : null}
                </View>

                <Text style={styles.rememberText}>
                  Remember me
                </Text>
              </Pressable>

              <Pressable onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>
                  Forgot Password?
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            disabled={isSubmitting}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
              isSubmitting && styles.loginButtonDisabled,
            ]}
          >
            <Text style={styles.loginButtonText}>
              {isSubmitting ? "Signing in..." : "Sign in to DCMS"}
            </Text>
          </Pressable>

          <View style={styles.warningCard}>
            <Ionicons
              name="shield-outline"
              size={20}
              color={COLORS.warningText}
            />

            <Text style={styles.warningText}>
              This system contains sensitive disaster and casualty
              data. Unauthorized access is prohibited and logged.
            </Text>
          </View>

          <Pressable
            style={styles.supportButton}
            onPress={() =>
              Alert.alert(
                "Technical support",
                "Please contact your Barangay IT Officer.",
              )
            }
          >
            <Text style={styles.supportText}>
              Having trouble? Contact your Barangay IT Officer
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardContainer: {
    flex: 1,
  },

  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },
  header: {
    minHeight: 126,
    overflow: "hidden",
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 22,
    justifyContent: "center",
  },
  headerCircleLarge: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    top: -120,
    right: -55,
    backgroundColor: "rgba(255, 255, 255, 0.045)",
  },
  headerCircleSmall: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    right: 55,
    bottom: -65,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  headerTextWrapper: {
    flex: 1,
  },
  portalText: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.7,
    marginBottom: 8,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingTop: 15,
    paddingBottom: 28,
  },
  description: {
    color: COLORS.secondaryText,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 25,
  },

  formGroup: {
    marginBottom: 19,
  },
  label: {
    color: COLORS.primaryText,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 9,
  },
  inputContainer: {
    minHeight: 53,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
  },
  input: {
    flex: 1,
    minHeight: 51,
    paddingHorizontal: 13,
    color: COLORS.primaryText,
    fontSize: 14,
  },

  optionsRow: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rememberButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 2,
    borderColor: "#C8D2E2",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: COLORS.white,
  },
  checkboxChecked: {
    borderColor: COLORS.maroon,
    backgroundColor: COLORS.maroon,
  },
  rememberText: {
    color: COLORS.secondaryText,
    fontSize: 13,
  },
  forgotText: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "600",
  },

  loginButton: {
    minHeight: 55,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    marginBottom: 20,
    backgroundColor: COLORS.maroon,
    shadowColor: COLORS.maroon,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 7,
  },
  loginButtonPressed: {
    opacity: 0.87,
    transform: [{ scale: 0.99 }],
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  warningCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 13,
    backgroundColor: COLORS.warningBackground,
  },
  warningText: {
    flex: 1,
    color: COLORS.warningText,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 10,
  },

  supportButton: {
    alignItems: "center",
    marginTop: 21,
    paddingVertical: 8,
  },
  supportText: {
    color: "#8293B2",
    fontSize: 11,
    textAlign: "center",
  },
});