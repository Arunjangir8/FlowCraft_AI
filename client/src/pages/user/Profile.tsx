import { Link } from "react-router-dom";
import { useAuth } from "../../components/Auth/AuthContext";
import Nav from "../../components/home/Nav";
import { Reveal } from "../../components/home/motion";
import { useMenuItems } from "../../hooks/useMenuItems";

export default function Profile() {
  const { user } = useAuth();
  const menuItems = useMenuItems();

  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Nav menuItems={menuItems} />

      <main className="mx-auto w-full max-w-2xl px-5 pt-28 pb-20 sm:px-8 sm:pt-32">
        <Reveal>
          <header className="border-b border-line pb-8">
            <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink">
              ← Dashboard
            </Link>
            <h1 className="mt-3 text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-[-0.02em] text-ink">
              Profile
            </h1>
          </header>
        </Reveal>

        <Reveal delay={1}>
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-white/60 p-6 backdrop-blur">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-2xl font-semibold text-accent">
                {initial}
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-ink">{user?.name || "Unnamed"}</p>
              <p className="text-sm text-ink-faint">{user?.email}</p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={2}>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white/60 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Plan</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {user?.subscription?.plan.displayName ?? "Free"}
              </p>
              {user?.subscription && (
                <p className="mt-1 text-xs text-ink-faint">
                  {user.subscription.status === "ACTIVE" ? "Renews" : "Status"}{" "}
                  {new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-line bg-white/60 p-5 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-ink-faint">Member since</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </Reveal>
      </main>
    </div>
  );
}
