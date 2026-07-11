import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { http } from "../../services/http";
import { useAuth } from "../../components/Auth/AuthContext";
import { DrawingLoader } from "../../components/common/Loader";
import Nav from "../../components/home/Nav";
import SpotlightCard from "../../components/home/bits/SpotlightCard";
import { EASE, Magnetic, Reveal } from "../../components/home/motion";

type FileData = {
  id: string;
  title: string;
  updatedAt: string;
  drawing?: {
    bgColor: string;
    updatedAt: string;
  };
};

const AI_FILE_LIMIT = 2;
const AI_LIMIT_CONTACT = "arunjangir9987@gmail.com";

export default function Dashboard() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [aiFilesUsed, setAiFilesUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const res = await http.private.get<{ success: boolean; data: FileData[]; aiFilesUsed: number }>("/drawing/files");
      if (res.data) {
        setFiles(res.data);
      }
      if (typeof res.aiFilesUsed === "number") {
        setAiFilesUsed(res.aiFilesUsed);
      }
    } catch (err) {
      console.error("Failed to load files", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFile = async () => {
    if (aiPrompt.trim() && aiFilesUsed >= AI_FILE_LIMIT) {
      setShowModal(false);
      setShowLimitModal(true);
      return;
    }

    try {
      setCreating(true);

      const res = await http.private.post<{ success: boolean; data: { id: string } }>(
        "/drawing/create",
        { title: "Untitled Drawing" }
      );

      const newFileId = res.data?.id;
      if (!newFileId) throw new Error("Failed to create file");

      if (aiPrompt.trim()) {
        await http.private.post("/ai/sendMessage", {
          fileId: newFileId,
          message: aiPrompt,
        });
        setAiFilesUsed((prev) => prev + 1);
      }

      navigate(`/draw/${newFileId}`);
    } catch (err: any) {
      if (err?.message === "AI_FILE_LIMIT_EXCEEDED") {
        setShowModal(false);
        setShowLimitModal(true);
      } else {
        console.error("Error creating file", err);
        alert("Failed to create file. Please try again.");
      }
    } finally {
      setCreating(false);
      setShowModal(false);
    }
  };

  const handleRename = async (fileId: string) => {
    if (!newTitle.trim()) {
      setRenamingId(null);
      return;
    }

    try {
      await http.private.patch(`/drawing/file/${fileId}`, { title: newTitle });
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, title: newTitle } : f))
      );
      setRenamingId(null);
      setNewTitle("");
    } catch (err) {
      console.error("Rename failed", err);
      alert("Failed to rename file");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await http.private.delete(`/drawing/file/${deleteId}`);
      setFiles((prev) => prev.filter((f) => f.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Nav />

      <main className="mx-auto w-full max-w-6xl px-5 pt-28 pb-20 sm:px-8 sm:pt-32">
        {/* ── Header ── */}
        <Reveal>
          <header className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-ink-faint">
                Your studio
              </p>
              <h1 className="mt-3 text-[clamp(1.9rem,4.5vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
                Welcome back, <span className="font-serif italic text-accent">{user?.name || "there"}</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="inline-flex h-13 items-center rounded-full border border-line px-6 text-[15px] font-medium text-ink-soft transition-colors duration-300 hover:border-ink hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Log out
              </button>
              <Magnetic strength={0.15}>
                <button
                  onClick={() => setShowModal(true)}
                  className="group inline-flex h-13 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-paper transition-colors duration-300 hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  New drawing
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </button>
              </Magnetic>
            </div>
          </header>
        </Reveal>

        {/* ── Body ── */}
        {loading ? (
          <div className="text-ink">
            <DrawingLoader />
          </div>
        ) : files.length === 0 ? (
          <Reveal delay={1}>
            <div className="mt-16 rounded-2xl border border-line bg-white/60 p-10 text-center backdrop-blur sm:p-16">
              <p className="mb-5 text-ink-soft">No drawings yet — the canvas is waiting.</p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex h-12 items-center rounded-full border border-line bg-white/60 px-6 text-[15px] font-medium text-ink backdrop-blur transition-colors duration-300 hover:border-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Create your first drawing
              </button>
            </div>
          </Reveal>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {files.map((file, i) => (
              <Reveal key={file.id} delay={Math.min(i, 4)}>
                <SpotlightCard className="group relative flex h-full flex-col rounded-2xl border border-line bg-white/60 p-4 pt-9 backdrop-blur transition-colors duration-300 hover:border-ink sm:p-5 sm:pt-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(file.id);
                    }}
                    className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-ink-faint transition-colors duration-300 hover:bg-coral/10 hover:text-coral"
                    aria-label="Delete file"
                  >
                    ✕
                  </button>

                  <div
                    onClick={() => navigate(`/draw/${file.id}`)}
                    className="mb-4 flex min-h-[100px] flex-1 cursor-pointer items-center justify-center rounded-xl border border-line bg-paper-deep transition-colors duration-300 group-hover:border-ink sm:min-h-[120px]"
                  >
                    <span className="text-[10px] uppercase tracking-[0.2em] text-ink-faint sm:text-xs">
                      Canvas
                    </span>
                  </div>

                  {renamingId === file.id ? (
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => handleRename(file.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(file.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      autoFocus
                      className="w-full rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-ink"
                    />
                  ) : (
                    <h3
                      onDoubleClick={() => {
                        setRenamingId(file.id);
                        setNewTitle(file.title);
                      }}
                      className="truncate text-sm font-semibold leading-tight text-ink sm:text-base"
                    >
                      {file.title}
                    </h3>
                  )}

                  <p className="mt-1 text-[10px] text-ink-faint sm:text-xs">
                    {new Date(file.updatedAt).toLocaleDateString()}
                  </p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        )}
      </main>

      {/* ── Delete Confirm Modal ── */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="w-full rounded-t-2xl border border-line bg-paper p-6 sm:w-full sm:max-w-sm sm:rounded-2xl"
            >
              <h2 className="mb-2 text-lg font-semibold tracking-tight text-ink">Delete file</h2>
              <p className="mb-6 text-sm leading-relaxed text-ink-soft">
                Are you sure you want to delete this file? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  disabled={deleting}
                  className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink-soft transition-colors duration-300 hover:border-ink hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 rounded-full bg-coral py-2.5 text-sm font-medium text-paper transition-colors duration-300 hover:bg-coral/90 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AI Limit Modal ── */}
      <AnimatePresence>
        {showLimitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="w-full rounded-t-2xl border border-line bg-paper p-6 sm:w-full sm:max-w-md sm:rounded-2xl sm:p-8"
            >
              <h2 className="mb-3 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                AI file limit reached
              </h2>
              <p className="mb-2 text-sm text-ink-soft">
                You can only create a maximum of{" "}
                <span className="font-semibold text-ink">{AI_FILE_LIMIT} files</span> with AI help.
              </p>
              <p className="mb-6 text-sm text-ink-soft">
                Need more? Contact us at{" "}
                <a
                  href={`mailto:${AI_LIMIT_CONTACT}`}
                  className="text-ink underline decoration-line underline-offset-4 transition-colors duration-300 hover:text-accent"
                >
                  {AI_LIMIT_CONTACT}
                </a>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-paper transition-colors duration-300 hover:bg-accent"
                >
                  Got it
                </button>
                <button
                  onClick={() => {
                    setAiPrompt("");
                    handleCreateFile();
                  }}
                  disabled={creating}
                  className="w-full rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors duration-300 hover:border-ink"
                >
                  {creating ? "Creating…" : "Create empty"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-night/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="w-full rounded-t-2xl border border-line bg-paper p-6 sm:w-full sm:max-w-lg sm:rounded-2xl sm:p-8"
            >
              <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                Create new file
              </h2>
              <p className="mb-5 text-sm text-ink-soft">
                Describe what you want AI to generate, or leave blank for an empty canvas.
              </p>

              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="E.g., A flowchart for a user login process…"
                className="mb-5 min-h-[90px] w-full resize-y rounded-xl border border-line bg-white/60 p-3 text-sm text-ink placeholder:text-ink-faint backdrop-blur transition-colors duration-300 focus:border-ink focus:outline-none sm:min-h-[100px]"
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                  className="flex-1 rounded-full border border-line py-2.5 text-sm font-medium text-ink-soft transition-colors duration-300 hover:border-ink hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFile}
                  disabled={creating}
                  className="flex-1 rounded-full bg-ink py-2.5 text-sm font-medium text-paper transition-colors duration-300 hover:bg-accent disabled:opacity-50"
                >
                  {creating
                    ? "Creating…"
                    : aiPrompt.trim()
                    ? "Generate & create"
                    : "Create empty"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
