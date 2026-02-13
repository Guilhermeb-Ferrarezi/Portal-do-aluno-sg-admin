import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PerfilPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Settings are now handled by the overlay in DashboardLayout.
    // Redirect to dashboard if someone navigates here directly.
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  return null;
}
