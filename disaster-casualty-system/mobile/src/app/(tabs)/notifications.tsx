import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Ionicons
        name="notifications-outline"
        size={46}
        color="#7B1113"
      />

      <Text style={styles.title}>Notifications</Text>

      <Text style={styles.description}>
        Verification updates, emergency alerts, and synchronization
        notices will appear here.
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