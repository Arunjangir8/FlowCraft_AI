import React, { useState } from "react";
import { http } from "../../services/http";
import { useAuth } from "../../components/Auth/AuthContext";
import { useNavigate } from "react-router-dom";

type Mode = "login" | "signup";

type AuthResponse = {
  success: boolean;
  message: string;
  data: {
    user: unknown;
    token?: string;
  };
};

const AuthForm: React.FC = () => {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const { refetchUser } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleMode = () => {
    setMode((prev) => (prev === "login" ? "signup" : "login"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      let response: AuthResponse;

      if (mode === "login") {
        response = await http.public.post<AuthResponse>("/user/sign-in", {
          email: form.email,
          password: form.password,
        });

        if (response.data.token) {
          localStorage.setItem("token", response.data.token);
          await refetchUser();
          navigate("/dashboard");
        }
      } else {
        response = await http.public.post<AuthResponse>("/user/sign-up", {
          name: form.name,
          email: form.email,
          password: form.password,
        });
      }

      alert(response.message);

      if (mode === "signup") {
        setMode("login");
      }

    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 font-sans text-white">
      <div className="w-full max-w-md bg-black border border-white p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          {mode === "login" ? "Login" : "Create Account"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-black text-white border border-white focus:outline-none focus:ring-1 focus:ring-white"
            />
          )}

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-black text-white border border-white focus:outline-none focus:ring-1 focus:ring-white"
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-black text-white border border-white focus:outline-none focus:ring-1 focus:ring-white"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-2 hover:bg-gray-200 transition disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm mt-4">
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}
          <button
            onClick={toggleMode}
            className="text-gray-400 ml-1 hover:text-white hover:underline transition-colors"
          >
            {mode === "login" ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;