import { useEffect, useState } from "react";

import { StatusCard } from "../components/common/StatusCard";
import { getServerHealth } from "../services/health.api";

type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; status: string; timestamp: string }
  | { kind: "error"; message: string };

export default function HomePage() {
  const [state, setState] = useState<UiState>({ kind: "idle" });

  useEffect(() => {
    let active = true;

    const loadHealth = async () => {
      try {
        setState({ kind: "loading" });
        const result = await getServerHealth();

        if (!active) return;

        setState({
          kind: "success",
          status: result.data.status,
          timestamp: result.data.timestamp,
        });
      } catch (error) {
        if (!active) return;

        const message =
          error instanceof Error ? error.message : "Could not reach backend";
        setState({ kind: "error", message });
      }
    };

    void loadHealth();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-3xl space-y-6 rounded-2xl bg-white p-8 shadow-sm">
        <header>
          <h1 className="text-3xl font-bold">Frontend Starter Ready</h1>
          <p className="mt-2 text-slate-600">
            Tailwind is configured and backend connection is set up.
          </p>
        </header>

        {state.kind === "loading" || state.kind === "idle" ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Checking backend health...
          </div>
        ) : null}

        {state.kind === "success" ? (
          <StatusCard
            title="Backend status"
            value={state.status}
            description={`Last checked: ${new Date(state.timestamp).toLocaleString()}`}
            tone="ok"
          />
        ) : null}

        {state.kind === "error" ? (
          <StatusCard
            title="Backend status"
            value="offline"
            description={state.message}
            tone="error"
          />
        ) : null}

        <section className="rounded-xl border border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Project structure</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>components: reusable UI blocks</li>
            <li>pages: page-level screens</li>
            <li>services: API calls and HTTP helpers</li>
            <li>types: shared TypeScript types</li>
            <li>config: environment and app constants</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
