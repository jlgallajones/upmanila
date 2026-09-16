import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { recoverPassword } from "../api/auth";
import {
  getUserFriendlyMessage,
  logUiError,
} from "../utils/uiMessages";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F7F8FB",
  card: "#FFFFFF",
  border: "#D7DFEB",
  text: "#15213A",
  muted: "#667085",
  danger: "#C92D32",
};

function getAccessTokenFromUrl(url: string | null): string {
  const candidates: string[] = [];

  if (url) {
    candidates.push(url);
  }

  if (Platform.OS === "web" && typeof window !== "undefined") {
    candidates.push(window.location.href);
  }

  for (const candidate of candidates) {
    const [withoutHash, hash = ""] = candidate.split("#");
    const query = withoutHash.split("?")[1] ?? "";

    for (const paramsText of [hash, query]) {
      const params = new URLSearchParams(paramsText);
      const token = params.get("access_token");

      if (token) {
        return token;
      }
    }
  }

  return "";
}

export default function ResetPasswordScreen() {
  const url = Linking.useURL();
  const accessToken = useMemo(() => getAccessTokenFromUrl(url), [url]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] =
  useState<string | null>(null);

  async function handleResetPassword() {
    if (!accessToken) {
      Alert.alert(
        "Invalid reset link",
        "This password reset link is missing its recovery token. Please request a new link.",
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Password too short",
        "Enter a new password with at least 6 characters.",
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords do not match",
        "Enter the same password in both fields.",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const message = await recoverPassword(accessToken, password);

      const successText =
        message || "Your password has been changed successfully.";

      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setSuccessMessage(successText);

      if (Platform.OS !== "web") {
        Alert.alert(
          "Password updated",
          successText,
          [
            {
              text: "Sign in",
              onPress: () => router.replace("/login"),
            },
          ],
        );
      }
    } catch (error) {
      logUiError("Password recovery failed", error);
      Alert.alert(
        "Unable to reset password",
        getUserFriendlyMessage(
          error,
          "This reset link may be invalid or expired. Please request a new link.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons
            name="key-outline"
            size={30}
            color={COLORS.maroon}
          />
        </View>

        <Text style={styles.eyebrow}>Account Recovery</Text>
        <Text style={styles.title}>Create a new password</Text>
        <Text style={styles.subtitle}>
          Enter a new password for your DCMS account.
        </Text>

        {successMessage ? (
        <View style={styles.successCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color="#2E7D4F"
          />

          <Text style={styles.successText}>
            {successMessage}
          </Text>
        </View>
      ) : null}

        {!accessToken ? (
          <View style={styles.warningCard}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.danger}
            />
            <Text style={styles.warningText}>
              This reset link is invalid or expired. Request a new
              password reset email from the login screen.
            </Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>NEW PASSWORD</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter new password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
            <Pressable
              onPress={() => setShowPassword((current) => !current)}
              hitSlop={10}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={COLORS.muted}
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.inputWrap}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
        </View>

        <Pressable
          disabled={isSubmitting || !accessToken}
          onPress={handleResetPassword}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            (isSubmitting || !accessToken) && styles.disabledButton,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? "Updating password..." : "Update password"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/login")}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  successCard: {
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 9,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: "#B9DEC5",
  backgroundColor: "#EFF8F2",
},

successText: {
  flex: 1,
  color: "#2E7D4F",
  fontSize: 13,
  lineHeight: 18,
  fontWeight: "700",
},
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 22,
    backgroundColor: COLORS.background,
  },
  card: {
    gap: 14,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  iconCircle: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#FFF2F2",
  },
  eyebrow: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  warningCard: {
    flexDirection: "row",
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0C5C5",
    backgroundColor: "#FFF4F4",
  },
  warningText: {
    flex: 1,
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  field: {
    gap: 7,
  },
  label: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  inputWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    backgroundColor: "#F6F8FB",
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  primaryButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },
  backButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backButtonText: {
    color: COLORS.maroon,
    fontSize: 14,
    fontWeight: "800",
  },
});
