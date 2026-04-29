import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useAuth } from "./AuthContext";
import { DrawingLoader } from "../common/Loader";
import { div } from "framer-motion/client";

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-full w-full bg-black flex items-center justify-center"><DrawingLoader/></div>;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default PublicRoute;
