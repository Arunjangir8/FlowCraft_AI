import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../services/http";
import { DrawingLoader } from "../../components/common/Loader";
import Nav from "../../components/home/Nav";
import { Reveal } from "../../components/home/motion";
import { useMenuItems } from "../../hooks/useMenuItems";

type FileUsage = {
  id: string;
  title: string;
  updatedAt: string;
  isAiFile: boolean;
  aiCallsUsed: number;
  aiCallsLimit: number | null;
  aiCallsRemaining: number | null;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

type UsageData = {
  aiFiles: {
    used: number;
    limit: number;
    remaining: number;
  };
  simpleFiles: {
    used: number;
    limit: number;
    remaining: number;
  };
  files: FileUsage[];
  lifetime: {
    chatsUsed: number;
    generationsUsed: number;
    chatsLimit: number | null;
    generationsLimit: number | null;
  };
};

function FileRow({
  file,
  isOpen,
  onToggle,
  messages,
  messagesLoading,
}: {
  file: FileUsage;
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  messagesLoading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/60 backdrop-blur">
      <button onClick={onToggle} className="flex w-full items-center justify-between p-4 text-left">
        <div>
          <p className="flex items-center gap-2 font-medium text-ink">
            {file.title}
            {file.isAiFile && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                ✨ AI
              </span>
            )}
          </p>
          <p className="text-xs text-ink-faint">
            Updated {new Date(file.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="text-right">
          {file.isAiFile ? (
            <>
              <p className="text-sm font-semibold text-ink">
                {file.aiCallsUsed} / {file.aiCallsLimit}
              </p>
              <p className="text-xs text-ink-faint">{file.aiCallsRemaining} left</p>
            </>
          ) : (
            <p className="text-xs text-ink-faint">No AI activity</p>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-line px-4 py-3">
          {messagesLoading ? (
            <p className="text-sm text-ink-faint">Loading messages…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-ink-faint">No messages.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className="font-semibold text-ink-soft">
                    {m.role === "USER" ? "You" : "AI"}:
                  </span>{" "}
                  <span className="text-ink">{m.content}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AiUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
    http.private
      .get<UsageData>("/ai/usage")
      .then(setData)
      .catch((err) => console.error("Failed to load AI usage", err))
      .finally(() => setLoading(false));
  }, []);

  const aiFileList = data?.files.filter((f) => f.isAiFile) ?? [];
  const simpleFileList = data?.files.filter((f) => !f.isAiFile) ?? [];
  const menuItems = useMenuItems();

  const toggleFile = async (fileId: string) => {
    if (openFileId === fileId) {
      setOpenFileId(null);
      return;
    }
    setOpenFileId(fileId);
    setMessagesLoading(true);
    try {
      const res = await http.private.get<{ messages: Message[] }>(`/ai/usage/${fileId}/messages`);
      setMessages(res.messages);
    } catch (err) {
      console.error("Failed to load messages", err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Nav menuItems={menuItems} />

      <main className="mx-auto w-full max-w-4xl px-5 pt-28 pb-20 sm:px-8 sm:pt-32">
        <Reveal>
          <header className="border-b border-line pb-8">
            <Link to="/dashboard" className="text-sm text-ink-faint hover:text-ink">
              ← Dashboard
            </Link>
            <h1 className="mt-3 text-[clamp(1.6rem,4vw,2.4rem)] font-semibold tracking-[-0.02em] text-ink">
              Usage
            </h1>
          </header>
        </Reveal>

        {loading ? (
          <div className="mt-16">
            <DrawingLoader />
          </div>
        ) : !data ? (
          <p className="mt-10 text-ink-soft">Couldn't load usage.</p>
        ) : (
          <>
            <Reveal delay={1}>
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-line bg-white/60 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">AI files created</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {data.aiFiles.used}
                    <span className="text-base font-normal text-ink-faint"> / {data.aiFiles.limit}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-white/60 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Chats (lifetime)</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {data.lifetime.chatsUsed}
                    {data.lifetime.chatsLimit != null && (
                      <span className="text-base font-normal text-ink-faint"> / {data.lifetime.chatsLimit}</span>
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-white/60 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-ink-faint">Simple files</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {data.simpleFiles.used}
                    <span className="text-base font-normal text-ink-faint"> / {data.simpleFiles.limit}</span>
                  </p>
                </div>
              </div>
            </Reveal>

            {aiFileList.length > 0 && (
              <>
                <Reveal delay={2}>
                  <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">
                    AI files
                  </h2>
                </Reveal>

                <div className="flex flex-col gap-3">
                  {aiFileList.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      isOpen={openFileId === f.id}
                      onToggle={() => toggleFile(f.id)}
                      messages={openFileId === f.id ? messages : []}
                      messagesLoading={messagesLoading}
                    />
                  ))}
                </div>
              </>
            )}

            {simpleFileList.length > 0 && (
              <>
                <Reveal delay={2}>
                  <h2 className="mt-10 mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">
                    Simple files
                  </h2>
                </Reveal>

                <div className="flex flex-col gap-3">
                  {simpleFileList.map((f) => (
                    <FileRow
                      key={f.id}
                      file={f}
                      isOpen={openFileId === f.id}
                      onToggle={() => toggleFile(f.id)}
                      messages={openFileId === f.id ? messages : []}
                      messagesLoading={messagesLoading}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
