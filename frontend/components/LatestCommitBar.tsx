"use client";

import React, { useState } from "react";
import { Check, Copy, ShieldCheck, History, Clock } from "lucide-react";
import { GitCommit as GitCommitType } from "@/lib/gitlite";

interface LatestCommitBarProps {
  latestCommit?: GitCommitType | null;
  totalCommits: number;
  onViewCommits?: () => void;
}

export default function LatestCommitBar({
  latestCommit,
  totalCommits,
  onViewCommits,
}: LatestCommitBarProps) {
  const [copied, setCopied] = useState(false);

  const authorName = latestCommit?.author.name;
  const message = latestCommit?.message || "No commits yet";

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!latestCommit) return;
    navigator.clipboard.writeText(latestCommit.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0f1524] border border-[#1e293b] rounded-t-xl text-xs text-[#94a3b8] transition-colors">
      {/* Left: Author, Commit Message, Cryptographic badge */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Modern Creator Avatar */}
        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 via-cyan-500 to-indigo-600 p-[1px] shrink-0">
          <div className="w-full h-full bg-[#0a0e17] rounded-[7px] flex items-center justify-center font-bold text-white text-[10px]">
            {authorName?.charAt(0).toUpperCase() || "G"}
          </div>
        </div>

        {/* Author Link */}
        {authorName && <span className="font-semibold text-[#f8fafc] shrink-0">{authorName}</span>}

        {/* Message */}
        <span
          onClick={onViewCommits}
          className="text-[#f8fafc] hover:text-cyan-400 cursor-pointer truncate font-normal transition-colors"
          title={message}
        >
          {message}
        </span>

        {/* Verified Badge */}
        {latestCommit && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono shrink-0">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            SHA-256
          </span>
        )}
      </div>

      {/* Right: Timestamp, SHA badge, Commit Count */}
      <div className="flex items-center gap-3 shrink-0 text-[#94a3b8] text-xs">
        {/* Relative time */}
        {latestCommit && (
        <div className="hidden md:flex items-center gap-1 text-[#64748b]">
          <Clock className="w-3 h-3" />
          <span>{latestCommit.timestamp}</span>
        </div>
        )}

        {/* Short SHA pill */}
        {latestCommit && (
          <div className="flex items-center bg-[#0a0e17] border border-[#1e293b] rounded-lg px-2 py-1 font-mono text-[11px] text-cyan-400 shadow-inner">
            <span className="hover:underline cursor-pointer" onClick={onViewCommits} title="Inspect snapshot">
              {latestCommit.shortId}
            </span>
            <button
              onClick={handleCopy}
              className="ml-2 text-[#64748b] hover:text-[#f8fafc] transition-colors"
              title="Copy full SHA-256 hash"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {/* Commit History Link */}
        <button
          onClick={onViewCommits}
          className="flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-lg bg-[#131b2e] hover:bg-[#1a243d] text-[#f8fafc] hover:text-emerald-400 border border-[#1e293b] transition-all"
        >
          <History className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            <strong>{totalCommits}</strong> commits
          </span>
        </button>
      </div>
    </div>
  );
}
