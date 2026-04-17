import * as React from "react";

function getSystemPreference() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePrefersReducedMotion(forceReduceMotion = false) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(
    forceReduceMotion || getSystemPreference()
  );

  React.useEffect(() => {
    if (forceReduceMotion) {
      setPrefersReducedMotion(true);
      return;
    }

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setPrefersReducedMotion(false);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    syncPreference();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreference);
      return () => mediaQuery.removeEventListener("change", syncPreference);
    }

    mediaQuery.addListener(syncPreference);
    return () => mediaQuery.removeListener(syncPreference);
  }, [forceReduceMotion]);

  return prefersReducedMotion;
}
