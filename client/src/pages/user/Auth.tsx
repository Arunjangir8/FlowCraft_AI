import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { http } from "../../services/http";
import { useAuth } from "../../components/Auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { env } from "../../config/env";
import type { User } from "../../types/api";

type Mode = "login" | "signup";

type AuthResponse = {
  success: boolean;
  message: string;
  data: {
    user: User;
    token?: string;
  };
};

const AuthForm = () => {
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

  const loginWithToken = async (token?: string) => {
    if (!token) return;

    localStorage.setItem("token", token);
    await refetchUser();
    navigate("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      setLoading(true);

      let response;

      if (mode === "login") {
        response = await http.public.post<AuthResponse>("/user/sign-in", {
          email: form.email,
          password: form.password,
        });

        await loginWithToken(response.data.token);
      } else {
        response = await http.public.post<AuthResponse>("/user/sign-up", {
          name: form.name,
          email: form.email,
          password: form.password,
        });
      }

      if (mode === "signup") {
        setMode("login");
      }
    } catch (err) {
      alert("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential?: string) => {
    if (!credential) {
      alert("Google login did not return a valid credential.");
      return;
    }

    try {
      setLoading(true);

      const response = await http.public.post<AuthResponse>(
        "/user/google-sign-in",
        {
          idToken: credential,
        }
      );

      await loginWithToken(response.data.token);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Google login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-black border-2 border-white p-8 shadow-[0_0_0_1px_white]"
      >
        <div className="text-center mb-4">
          <motion.h2
            key={mode}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-2xl font-extrabold tracking-wide"
          >
            {mode === "login" ? "LOGIN" : "CREATE ACCOUNT"}
          </motion.h2>

          {mode === "login" && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="text-xs mt-2 text-gray-300 tracking-wide"
            >
              WELCOME BACK — LOGIN TO CONTINUE
            </motion.p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="h-13 overflow-hidden">
            <AnimatePresence mode="wait">
              {mode === "signup" ? (
                <motion.input
                  key="name"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  type="text"
                  name="name"
                  placeholder="FULL NAME"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-black text-white border-2 border-white focus:outline-none"
                />
              ) : (
                <div className="h-full" />
              )}
            </AnimatePresence>
          </div>

          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="email"
            name="email"
            placeholder="EMAIL"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-black text-white border-2 border-white focus:outline-none"
          />

          <motion.input
            whileFocus={{ scale: 1.02 }}
            type="password"
            name="password"
            placeholder="PASSWORD"
            value={form.password}
            onChange={handleChange}
            className="w-full px-4 py-2 bg-black text-white border-2 border-white focus:outline-none"
          />

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-extrabold py-2 border-2 border-white hover:bg-black hover:text-white transition disabled:opacity-50"
          >
            {loading
              ? "PLEASE WAIT..."
              : mode === "login"
              ? "LOGIN"
              : "SIGN UP"}
          </motion.button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 h-0.5 bg-white" />
          <p className="mx-3 text-xs">OR</p>
          <div className="flex-1 h-0.5 bg-white" />
        </div>

        {env.googleClientId ? (
          <div className="w-full flex justify-center">
            <GoogleLogin
              onSuccess={(credentialResponse: CredentialResponse) =>
                handleGoogleSuccess(credentialResponse.credential)
              }
              onError={() => alert("Google login failed")}
              theme="filled_black"
              shape="rectangular"
              size="large"
              text="continue_with"
              width="380"
            />
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-gray-400 py-2 font-bold border-2 border-gray-700 cursor-not-allowed"
          >
            SET VITE_GOOGLE_CLIENT_ID TO ENABLE GOOGLE LOGIN
          </button>
        )}

        <p className="text-center text-sm mt-6">
          {mode === "login"
            ? "DON'T HAVE AN ACCOUNT?"
            : "ALREADY HAVE AN ACCOUNT?"}
          <button
            onClick={toggleMode}
            className="ml-2 underline font-bold"
          >
            {mode === "login" ? "SIGN UP" : "LOGIN"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default AuthForm;