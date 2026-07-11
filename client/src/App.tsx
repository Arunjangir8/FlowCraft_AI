import { BrowserRouter, Routes, Route } from "react-router-dom";
import DrawingPadPage from "./pages/draw/Draw";
import HomePage from "./pages/HomePage";
import AuthForm from "./pages/user/Auth";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import PublicRoute from "./components/Auth/PublicRoute";
import Dashboard from "./pages/user/Dashboard";
import AiUsage from "./pages/user/Usage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/usage"
          element={
            <ProtectedRoute>
              <AiUsage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/draw"
          element={
            <ProtectedRoute>
              <DrawingPadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/draw/:fileId"
          element={
            <ProtectedRoute>
              <DrawingPadPage />
            </ProtectedRoute>
          }
        />

        <Route path="/login" element={<PublicRoute><AuthForm /></PublicRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App; 