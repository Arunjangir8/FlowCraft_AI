import { Navigate } from "react-router-dom";
import type { JSX } from "react";
import { useAuth } from "./AuthContext";
import { DrawingLoader } from "../common/Loader";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-full w-full bg-black flex justify-center items-center"><DrawingLoader/></div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;