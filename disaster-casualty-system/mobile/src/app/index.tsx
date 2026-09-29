import { router } from "expo-router";
import { useEffect } from "react";

import {
  getAccessToken,
  getCurrentUser,
} from "../auth/session";

export default function IndexRedirect() {
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

      router.replace(user && token ? "/home" : "/login");
    }

    void routeFromStoredSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
