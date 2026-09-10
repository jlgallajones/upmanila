export const uiMessages = {
  loading: {
    signingIn: "Signing in...",
    loadingRecords: "Loading records...",
    saving: "Saving changes...",
    submitting: "Submitting record...",
  },
  success: {
    saved: "Changes saved.",
    submitted: "Record submitted.",
    deleted: "Record deleted.",
  },
  error: {
    generic: "Something went wrong. Please try again.",
    network:
      "Unable to reach the server. Please check your connection and try again.",
    sessionExpired: "Your session has expired. Please sign in again.",
    duplicate:
      "A matching record already exists. Please review the entry and try again.",
  },
};

export function getUserFriendlyMessage(
  message: unknown,
  fallback = uiMessages.error.generic,
): string {
  const rawMessage =
    message instanceof Error
      ? message.message.trim()
      : String(message || "").trim();
  const normalizedMessage = rawMessage.toLowerCase();

  if (!rawMessage) return fallback;

  if (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("failed to fetch")
  ) {
    return uiMessages.error.network;
  }

  if (
    normalizedMessage.includes("jwt") ||
    normalizedMessage.includes("invalid or expired") ||
    normalizedMessage.includes("authentication token") ||
    normalizedMessage.includes("unauthorized")
  ) {
    return uiMessages.error.sessionExpired;
  }

  if (
    normalizedMessage.includes("duplicate key") ||
    normalizedMessage.includes("already exists")
  ) {
    return uiMessages.error.duplicate;
  }

  if (
    normalizedMessage.includes("supabase") ||
    normalizedMessage.includes("violates") ||
    normalizedMessage.includes("foreign key") ||
    normalizedMessage.includes("null value") ||
    normalizedMessage.includes("database") ||
    normalizedMessage.includes("syntaxerror") ||
    normalizedMessage.includes("request failed with status 500")
  ) {
    return fallback;
  }

  return rawMessage;
}

export function logUiError(context: string, error: unknown): void {
  console.error(`[DCMS UI] ${context}`, error);
}
