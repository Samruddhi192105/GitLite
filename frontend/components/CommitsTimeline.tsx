"use client";

import React, { useState } from "react";
import { Copy, Check, GitCommit as GitCommitIcon, Code, FileText, ArrowLeft, Calendar } from "lucide-react";
import { GitCommit } from "@/lib/gitlite";

interface CommitsTimelineProps {
  commits: GitCommit[];
  onBack: () => void;
  onCheckoutCommit?: (commitId: string) => void;
  onViewSnapshot?: (commitId: string) => void;
}

export default function CommitsTimeline({
  commits,
  onBack,
  onCheckoutCommit,
  onViewSnapshot,
}: CommitsTimelineProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 my-4 text-xs">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#58a6ff] hover:underline font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to repository code</span>
        </button>
        <span className="text-[#7d8590]">
          Total: <strong className="text-[#e6edf3]">{commits.length}</strong> commits in history
        </span>
      </div>

      {/* Commits Container */}
      <div className="border border-[#30363d] rounded-md bg-[#0d1117] overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between font-semibold text-[#e6edf3]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#7d8590]" />
            <span>Commit history across this repository</span>
          </div>
          <span className="text-[11px] font-mono text-[#7d8590]">SHA-256 Hashes</span>
        </div>

        {/* List of Commits */}
        <div className="divide-y divide-[#21262d]">
          {commits.length === 0 ? (
            <div className="p-8 text-center text-[#7d8590]">No commits found in GitLite.</div>
          ) : (
            commits.map((commit) => (
              <div
                key={commit.id}
                onClick={() => setSelectedCommit(commit)}
                className="group flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[#161b22] cursor-pointer transition-colors"
              >
                {/* Left: Message & Author info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="mt-0.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 border border-[#30363d] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {commit.author.name.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-[#e6edf3] group-hover:text-[#58a6ff] truncate text-xs">
                      {commit.message}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[#7d8590] mt-1 flex-wrap">
                      <span className="font-semibold text-[#c9d1d9]">{commit.author.name}</span>
                      <span>committed on {commit.timestamp}</span>
                      {commit.parent && (
                        <span className="text-[#8b949e]">
                          parent <code className="font-mono text-[10px]">{commit.parent.substring(0, 7)}</code>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions, Short SHA, Snapshot button */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Short Hash pill */}
                  <div className="flex items-center bg-[#161b22] group-hover:bg-[#21262d] border border-[#30363d] rounded px-2 py-1 font-mono text-[11px] text-[#58a6ff]">
                    <span>{commit.shortId}</span>
                    <button
                      onClick={(e) => handleCopy(commit.id, e)}
                      className="ml-1.5 text-[#7d8590] hover:text-[#e6edf3]"
                      title="Copy full commit SHA"
                    >
                      {copiedId === commit.id ? (
                        <Check className="w-3.5 h-3.5 text-[#2ea043]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Browse Snapshot Code Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewSnapshot?.(commit.id);
                    }}
                    className="p-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#7d8590] hover:text-[#e6edf3] border border-[#30363d] transition-colors"
                    title="Browse the repository at this point in history"
                  >
                    <Code className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Selected Commit Detail Modal */}
      {selectedCommit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl overflow-hidden flex flex-col text-xs text-[#e6edf3]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
              <div className="flex items-center gap-2">
                <GitCommitIcon className="w-4 h-4 text-[#58a6ff]" />
                <span className="font-semibold text-sm">Commit Details</span>
              </div>
              <button
                onClick={() => setSelectedCommit(null)}
                className="text-[#7d8590] hover:text-[#e6edf3] font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <span className="text-[#7d8590] font-semibold">Message:</span>
                <p className="text-sm font-semibold text-[#e6edf3] mt-1">{selectedCommit.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#30363d] text-xs">
                <div>
                  <span className="text-[#7d8590]">Commit Hash:</span>
                  <p className="font-mono text-[11px] text-[#58a6ff] break-all">{selectedCommit.id}</p>
                </div>
                <div>
                  <span className="text-[#7d8590]">Timestamp:</span>
                  <p className="text-[#e6edf3]">{selectedCommit.timestamp}</p>
                </div>
                <div>
                  <span className="text-[#7d8590]">Branch:</span>
                  <p className="font-mono text-[#3fb950]">{selectedCommit.branch}</p>
                </div>
                <div>
                  <span className="text-[#7d8590]">Parent Commit:</span>
                  <p className="font-mono text-[11px] text-[#8b949e]">
                    {selectedCommit.parent ? selectedCommit.parent : "None (Root Commit)"}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-[#30363d]">
                <span className="font-semibold text-[#7d8590]">Snapshotted Files ({selectedCommit.files.length}):</span>
                <div className="mt-2 space-y-1">
                  {selectedCommit.files.length === 0 ? (
                    <p className="text-[#7d8590] italic">No files snapshotted in this commit.</p>
                  ) : (
                    selectedCommit.files.map((f) => (
                      <div key={f} className="flex items-center gap-2 p-1.5 rounded bg-[#0d1117] border border-[#21262d]">
                        <FileText className="w-3.5 h-3.5 text-[#58a6ff]" />
                        <span className="font-mono text-xs">{f}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-[#30363d] bg-[#161b22]">
              <button
                onClick={() => {
                  onCheckoutCommit?.(selectedCommit.id);
                  setSelectedCommit(null);
                }}
                className="px-3 py-1.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] border border-[#30363d] font-semibold"
              >
                Checkout this commit
              </button>
              <button
                onClick={() => {
                  onViewSnapshot?.(selectedCommit.id);
                  setSelectedCommit(null);
                }}
                className="px-3 py-1.5 rounded bg-[#238636] hover:bg-[#2ea043] text-white font-semibold"
              >
                View Snapshot Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
