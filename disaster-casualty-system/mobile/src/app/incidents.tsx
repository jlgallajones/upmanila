import { StyleSheet, Text, View } from "react-native";

export default function IncidentsPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Active Incidents</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#f4f7fb",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
  },
});