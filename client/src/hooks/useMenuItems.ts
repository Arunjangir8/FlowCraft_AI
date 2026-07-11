import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/Auth/AuthContext";
import type { StaggeredMenuItem } from "../components/home/bits/StaggeredMenu";

// Shared Dashboard/Usage/Profile/Terms nav menu. `onNewDrawing` lets Dashboard
// open its create-file modal directly; other pages just navigate there.
export function useMenuItems(onNewDrawing?: () => void): StaggeredMenuItem[] {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return [
    { label: "Dashboard", onClick: onNewDrawing ?? (() => navigate("/dashboard")), path: "/dashboard" },
    { label: "Usage", onClick: () => navigate("/usage"), path: "/usage" },
    { label: "Profile", onClick: () => navigate("/profile"), path: "/profile" },
    { label: "Terms & Policy", onClick: () => navigate("/terms"), path: "/terms" },
    {
      label: "Log out",
      onClick: () => {
        logout();
        navigate("/login");
      },
      danger: true,
    },
  ];
}
