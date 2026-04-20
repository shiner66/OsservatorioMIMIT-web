import { useCallback, useEffect, useState } from "react";
import type { UserPreferences } from "../types";

const STORAGE_KEY = "carburanti:prefs:v1";

const DEFAULTS: UserPreferences = {
  favoriteFuel: "Benzina",
  mode: "all",
  radius: 5000,
};

export function usePreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULTS;
      return { ...DEFAULTS, ...(JSON.parse(raw) as UserPreferences) };
    } catch {
      return DEFAULTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage non disponibile */
    }
  }, [prefs]);

  const update = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  return { prefs, update };
}
