import AsyncStorage from "@react-native-async-storage/async-storage";

const responderAssignmentKey = "dcms.responderAssignment";

export type ResponderAssignment =
  | "field_responder"
  | "sa_responder";

export async function getResponderAssignment(): Promise<
  ResponderAssignment | null
> {
  const storedAssignment = await AsyncStorage.getItem(
    responderAssignmentKey,
  );

  return storedAssignment === "field_responder" ||
    storedAssignment === "sa_responder"
    ? storedAssignment
    : null;
}

export async function saveResponderAssignment(
  assignment: ResponderAssignment,
): Promise<void> {
  await AsyncStorage.setItem(responderAssignmentKey, assignment);
}

export async function clearResponderAssignment(): Promise<void> {
  await AsyncStorage.removeItem(responderAssignmentKey);
}
