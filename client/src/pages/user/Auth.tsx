import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { Link, useNavigate } from "react-router-dom";
import { http } from "../../services/http";
import { useAuth } from "../../components/Auth/AuthContext";
import { env } from "../../config/env";
import type { User } from "../../types/api";
import { LineaMark } from "../../components/home/Nav";
import DotGrid from "../../components/home/bits/DotGrid";
import { EASE, Magnetic } from "../../components/home/motion";

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

  const inputClass =
    "w-full rounded-xl border border-line bg-white/60 px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint backdrop-blur transition-colors duration-300 focus:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 text-ink">
      <DotGrid className="[mask-image:radial-gradient(circle_at_center,black_10%,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute bottom-0 -right-40 h-[420px] w-[420px] rounded-full bg-coral/10 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="relative w-full max-w-md rounded-2xl border border-line bg-white/70 p-8 shadow-[0_1px_0_0_var(--color-line)] backdrop-blur-md sm:p-10"
      >
        <Link
          to="/"
          className="mb-8 flex items-center justify-center gap-2 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <LineaMark />
          <span className="text-[17px] font-semibold tracking-tight">Linea</span>
        </Link>

        <div className="text-center mb-7">
          <motion.h1
            key={mode}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[clamp(1.6rem,4vw,2rem)] font-semibold tracking-[-0.02em] text-ink"
          >
            {mode === "login" ? (
              <>Welcome <span className="font-serif italic text-accent">back</span></>
            ) : (
              <>Start <span className="font-serif italic text-accent">drawing</span></>
            )}
          </motion.h1>
          <p className="mt-2 text-sm text-ink-soft">
            {mode === "login"
              ? "Sign in to pick up where you left off."
              : "Create an account — it's free."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="h-14 overflow-hidden">
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
                  placeholder="Full name"
                  value={form.name}
                  onChange={handleChange}
                  className={inputClass}
                />
              ) : (
                <div className="h-full" />
              )}
            </AnimatePresence>
          </div>

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className={inputClass}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className={inputClass}
          />

          <Magnetic strength={0.08} className="block w-full">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-13 w-full items-center justify-center rounded-full bg-ink text-[15px] font-medium text-paper transition-colors duration-300 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
            </button>
          </Magnetic>
        </form>

        <div className="my-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <p className="text-xs uppercase tracking-[0.18em] text-ink-faint">or</p>
          <div className="h-px flex-1 bg-line" />
        </div>

        {env.googleClientId ? (
          <div className="flex w-full justify-center">
            <GoogleLogin
              onSuccess={(credentialResponse: CredentialResponse) =>
                handleGoogleSuccess(credentialResponse.credential)
              }
              onError={() => alert("Google login failed")}
              theme="outline"
              shape="pill"
              size="large"
              text="continue_with"
              width="360"
            />
          </div>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line bg-paper-deep py-3 text-sm font-medium text-ink-faint cursor-not-allowed"
          >
            Set VITE_GOOGLE_CLIENT_ID to enable Google login
          </button>
        )}

        <p className="mt-7 text-center text-sm text-ink-soft">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={toggleMode}
            className="font-medium text-ink underline decoration-line underline-offset-4 transition-colors duration-300 hover:text-accent"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default AuthForm;
