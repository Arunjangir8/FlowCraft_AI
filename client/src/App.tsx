import { BrowserRouter, Routes, Route } from "react-router-dom";
import DrawingPadPage from "./pages/draw/Draw";
import HomePage from "./pages/HomePage";
import AuthForm from "./pages/user/Auth";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
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

        <Route path="/login" element={<AuthForm />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App; 