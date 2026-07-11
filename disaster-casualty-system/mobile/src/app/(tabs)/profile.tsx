import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Ionicons name="person-circle-outline" size={54} color="#7B1113" />

      <Text style={styles.title}>User Profile</Text>

      <Text style={styles.description}>
        View responder details, assigned area, and account settings.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F3F5F9",
  },
  title: {
    fontSize: 23,
    fontWeight: "800",
    marginTop: 15,
    color: "#15213A",
  },
  description: {
    fontSize: 14,
    color: "#78849A",
    textAlign: "center",
    marginTop: 8,
  },
});