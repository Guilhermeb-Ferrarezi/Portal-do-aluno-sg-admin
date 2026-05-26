import { useEffect } from "react";

// SSO is now handled by auth.santos-tech.com
export default function SsoCallback() {
  useEffect(() => {
    window.location.replace("https://auth.santos-tech.com");
  }, []);
  return null;
}
