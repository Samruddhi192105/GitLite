"use client";

import React, { useState } from "react";
import confetti from "canvas-confetti";
import { X, Plus, Check, FileText, AlertCircle } from "lucide-react";
import { GitStatus } from "@/lib/gitlite";

interface StageCommitModalProps {
  repositoryId: string;
  status: GitStatus | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function StageCommitModal({
  repositoryId,
  status,
  onClose,
  onRefresh,
}: StageCommitModalProps) {
  const [commitMessage, setCommitMessage] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [showCreateFile, setShowCreateFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStageFile = async (file: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gitlite/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stage", file, repoId: repositoryId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to stage file");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gitlite/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createFile",
          repoId: repositoryId,
          filename: newFileName.trim(),
          content: newFileContent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create file");
      setNewFileName("");
      setNewFileContent("");
      setShowCreateFile(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setError("Please write a commit message.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/gitlite/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          repoId: repositoryId,
          message: commitMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to commit");

      // Celebrate with confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#238636", "#58a6ff", "#f0883e", "#a371f7"],
        });
      } catch {}

      setCommitMessage("");
      onRefresh();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stagedFiles = status?.stagedFiles || [];
  const workingFiles = status?.workingFiles || [];
  const unstagedFiles = status?.unstagedFiles
    || workingFiles.filter((file) => !stagedFiles.includes(file));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-[#e6edf3]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#238636]" />
            <h3 className="font-semibold text-sm">Commit Changes to GitLite</h3>
            <span className="text-[#7d8590] text-xs font-mono">
              Branch: {status?.currentBranch || "main"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#7d8590] hover:text-[#e6edf3] p-1 rounded hover:bg-[#21262d]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-md bg-[#f85149]/15 border border-[#f85149]/30 text-[#f85149] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Staging & Working Files Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unstaged Files in working/ */}
            <div className="border border-[#30363d] rounded-md p-3 bg-[#0d1117] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-[#7d8590]">
                    Working Directory ({unstagedFiles.length})
                  </span>
                  <button
                    onClick={() => setShowCreateFile(!showCreateFile)}
                    className="text-[#58a6ff] hover:underline flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New file</span>
                  </button>
                </div>

                {/* Create File Form */}
                {showCreateFile && (
                  <form onSubmit={handleCreateFile} className="mb-3 p-2 bg-[#161b22] border border-[#30363d] rounded space-y-2">
                    <input
                      type="text"
                      placeholder="e.g. hello.txt"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#e6edf3]"
                      required
                    />
                    <textarea
                      rows={2}
                      placeholder="File contents..."
                      value={newFileContent}
                      onChange={(e) => setNewFileContent(e.target.value)}
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-xs text-[#e6edf3]"
                    />
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setShowCreateFile(false)}
                        className="px-2 py-0.5 rounded text-[#7d8590] hover:text-[#e6edf3]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-2 py-0.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white font-semibold"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {unstagedFiles.length === 0 ? (
                    <p className="text-[11px] text-[#7d8590] italic py-2">
                      No unstaged changes in working/
                    </p>
                  ) : (
                    unstagedFiles.map((file) => (
                      <div
                        key={file}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-[#161b22] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="w-3.5 h-3.5 text-[#7d8590] shrink-0" />
                          <span className="font-mono truncate">{file}</span>
                        </div>
                        <button
                          onClick={() => handleStageFile(file)}
                          disabled={loading}
                          className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] border border-[#30363d] font-semibold text-[10px] shrink-0"
                        >
                          + Stage
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Staged Area in .gitlite/staging */}
            <div className="border border-[#30363d] rounded-md p-3 bg-[#0d1117]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-[#3fb950] flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 text-[#3fb950]" />
                  Staged for Commit ({stagedFiles.length})
                </span>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto">
                {stagedFiles.length === 0 ? (
                  <div className="py-6 text-center text-[#7d8590] text-[11px]">
                    <p>No files currently staged.</p>
                    <p className="text-[10px] mt-1 text-[#484f58]">
                      Click "+ Stage" on any working file to include it in the next commit.
                    </p>
                  </div>
                ) : (
                  stagedFiles.map((file) => (
                    <div
                      key={file}
                      className="flex items-center justify-between p-1.5 rounded bg-[#238636]/10 border border-[#238636]/20"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <FileText className="w-3.5 h-3.5 text-[#3fb950] shrink-0" />
                        <span className="font-mono text-[#3fb950] truncate">{file}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#3fb950]">staged</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Commit Message Box */}
          <div className="space-y-1.5">
            <label className="font-semibold text-xs text-[#e6edf3]">
              Commit message:
            </label>
            <input
              type="text"
              placeholder="e.g. feat: add authentication login component"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-xs text-[#e6edf3] placeholder-[#7d8590] focus:outline-none focus:border-[#58a6ff]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#30363d] bg-[#161b22]">
          <span className="text-[11px] text-[#7d8590]">
            Files will be snapshotted and hashed into <code>.gitlite/commits</code>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCommit}
              disabled={loading || stagedFiles.length === 0 || !commitMessage.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white font-semibold shadow-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{loading ? "Committing..." : "Commit changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
