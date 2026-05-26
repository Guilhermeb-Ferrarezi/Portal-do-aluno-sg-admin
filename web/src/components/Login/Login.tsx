import { useEffect } from "react";

// Login is now handled by auth.santos-tech.com
export default function Login() {
  useEffect(() => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.replace(`https://auth.santos-tech.com?redirect=${encodeURIComponent(redirectUrl)}`);
  }, []);
  return null;
}
