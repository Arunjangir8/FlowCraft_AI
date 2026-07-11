import { useNavigate } from "react-router-dom";
import { useAuth } from "../components/Auth/AuthContext";
import type { StaggeredMenuItem } from "../components/home/bits/StaggeredMenu";

// Shared Dashboard/Usage/Profile/Terms nav menu. `onNewDrawing` lets Dashboard
// open its create-file modal directly; other pages just navigate there.
export function useMenuItems(onNewDrawing?: () => void): StaggeredMenuItem[] {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return [
    { label: "New drawing", onClick: onNewDrawing ?? (() => navigate("/dashboard")) },
    { label: "Usage", onClick: () => navigate("/usage") },
    { label: "Profile", onClick: () => navigate("/profile") },
    { label: "Terms & Policy", onClick: () => navigate("/terms") },
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
