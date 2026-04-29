import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { http } from "../services/http";
import { useAuth } from "../components/Auth/AuthContext";

type FileData = {
  id: string;
  title: string;
  updatedAt: string;
  drawing?: {
    bgColor: string;
    updatedAt: string;
  };
};

export default function Dashboard() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const res = await http.private.get<{ success: boolean; data: FileData[] }>("/drawing/files");
      if (res.data) {
        setFiles(res.data);
      }
    } catch (err) {
      console.error("Failed to load files", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFile = async () => {
    try {
      setCreating(true);
      // Create an empty file first
      const res = await http.private.post<{ success: boolean; data: { id: string } }>("/drawing/create", { title: "Untitled Drawing" });
      const newFileId = res.data?.id;
      
      if (!newFileId) throw new Error("Failed to create file");

      if (aiPrompt.trim()) {
        // Use AI to generate initial shapes
        await http.private.post("/ai/sendMessage", {
          fileId: newFileId,
          message: aiPrompt,
        });
      }

      navigate(`/draw/${newFileId}`);
    } catch (err) {
      console.error("Error creating file", err);
      alert("Failed to create file. Please try again.");
    } finally {
      setCreating(false);
      setShowModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10 font-sans">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex justify-between items-center mb-10 border-b border-white pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Drawings</h1>
            <p className="mt-2 text-gray-400">Welcome back, {user?.name || "User"}</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-black px-5 py-2 font-semibold text-sm hover:bg-gray-200 transition-colors"
          >
            + Create New
          </button>
        </header>

        {loading ? (
          <div className="text-gray-400 text-center py-10">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="text-center py-20 border border-white p-10 bg-black">
            <p className="text-gray-400 mb-4">No drawings found.</p>
            <button
              onClick={() => setShowModal(true)}
              className="border border-white text-white px-5 py-2 hover:bg-white hover:text-black transition-colors"
            >
              Create your first drawing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => navigate(`/draw/${file.id}`)}
                className="group border border-gray-800 hover:border-white p-5 cursor-pointer transition-colors bg-black flex flex-col"
              >
                <div className="flex-1 flex items-center justify-center min-h-[120px] mb-4 bg-gray-900 border border-gray-800 group-hover:border-white transition-colors">
                   <span className="text-gray-500 text-xs uppercase tracking-widest">Canvas</span>
                </div>
                <h3 className="text-lg font-semibold truncate text-white">{file.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Updated: {new Date(file.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-black border border-white p-8 max-w-lg w-full">
            <h2 className="text-2xl font-bold mb-2">Create New File</h2>
            <p className="text-gray-400 text-sm mb-6">
              Would you like to use AI to generate the starting face of the drawing? 
              Describe what you want, or leave it blank for an empty canvas.
            </p>
            
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="E.g., A flowchart for a user login process..."
              className="w-full bg-black border border-gray-700 p-3 text-white focus:border-white focus:outline-none min-h-[100px] mb-6 resize-y"
            />
            
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFile}
                disabled={creating}
                className="bg-white text-black px-6 py-2 text-sm font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : (aiPrompt.trim() ? "Generate & Create" : "Create Empty")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
