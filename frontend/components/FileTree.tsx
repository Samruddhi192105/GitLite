"use client";

import React from "react";
import { Folder, FileCode, FileText, File, CornerLeftUp, Coffee, Layers } from "lucide-react";
import { RepoItem } from "@/lib/gitlite";

interface FileTreeProps {
  items: RepoItem[];
  onOpenDirectory: (item: RepoItem) => void;
  onOpenFile: (item: RepoItem) => void;
  onNavigateUp?: () => void;
  isSubdirectory?: boolean;
}

export default function FileTree({
  items,
  onOpenDirectory,
  onOpenFile,
  onNavigateUp,
  isSubdirectory = false,
}: FileTreeProps) {
  const getFileIcon = (item: RepoItem) => {
    if (item.type === "directory") {
      return (
        <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Folder className="w-3.5 h-3.5 text-cyan-400" />
        </div>
      );
    }
    const ext = item.name.split(".").pop()?.toLowerCase();
    if (ext === "java") {
      return (
        <div className="w-5 h-5 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Coffee className="w-3.5 h-3.5 text-amber-400" />
        </div>
      );
    }
    if (ext === "md") {
      return (
        <div className="w-5 h-5 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
        </div>
      );
    }
    if (ext === "json" || ext === "ts" || ext === "js" || ext === "xml") {
      return (
        <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <FileCode className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      );
    }
    return (
      <div className="w-5 h-5 rounded-md bg-slate-500/10 border border-slate-500/20 flex items-center justify-center shrink-0">
        <File className="w-3.5 h-3.5 text-slate-400" />
      </div>
    );
  };

  return (
    <div className="w-full border-x border-b border-[#1e293b] rounded-b-xl divide-y divide-[#161f33] bg-[#0a0e17] text-xs overflow-hidden shadow-lg shadow-black/20">
      {/* Navigate Up Row if in subdirectory */}
      {isSubdirectory && (
        <div
          onClick={onNavigateUp}
          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-[#0f1524] text-cyan-400 cursor-pointer transition-colors"
        >
          <CornerLeftUp className="w-4 h-4 text-[#64748b]" />
          <span className="font-semibold font-mono">..</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-[#64748b]">
          <Layers className="w-8 h-8 text-[#334155] mx-auto mb-2" />
          <p>This directory is currently empty.</p>
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.path}
            onClick={() => {
              if (item.type === "directory") {
                onOpenDirectory(item);
              } else {
                onOpenFile(item);
              }
            }}
            className="group flex items-center justify-between px-4 py-2.5 hover:bg-[#0f1524] cursor-pointer transition-colors"
          >
            {/* File Icon & Name */}
            <div className="flex items-center gap-3 w-1/3 min-w-[200px] truncate">
              {getFileIcon(item)}
              <span
                className={`truncate font-normal transition-colors ${
                  item.type === "directory"
                    ? "text-[#f8fafc] font-medium group-hover:text-cyan-400"
                    : "text-[#cbd5e1] group-hover:text-[#f8fafc]"
                }`}
              >
                {item.name}
              </span>
            </div>

            {/* Commit Message */}
            <div className="hidden sm:block flex-1 px-4 truncate text-[#64748b] group-hover:text-[#94a3b8] transition-colors">
              <span className="truncate">{item.lastCommitMessage || "Update file"}</span>
            </div>

            {/* Commit Age */}
            <div className="text-right text-[#64748b] text-[11px] shrink-0 font-mono">
              {item.lastCommitAge || "today"}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
