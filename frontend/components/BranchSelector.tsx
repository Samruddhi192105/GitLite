"use client";

import React, { useState, useEffect, useRef } from "react";
import { GitBranch } from "lucide-react";
import { Check, Search, X, Plus, Home } from "lucide-react";

interface BranchSelectorProps {
  currentBranch: string;
  branches: string[];
  onSelectBranch: (branchName: string) => void;
  onCreateBranch?: (newBranchName: string) => void;
  pathBreadcrumbs?: string[];
  onNavigateBreadcrumb?: (index: number) => void;
  mode?: "project" | "snapshot";
  onToggleMode?: (mode: "project" | "snapshot") => void;
}

export default function BranchSelector({
  currentBranch,
  branches,
  onSelectBranch,
  onCreateBranch,
  pathBreadcrumbs = [],
  onNavigateBreadcrumb,
  mode = "project",
  onToggleMode,
}: BranchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredBranches = branches.filter((b) =>
    b.toLowerCase().includes(filterText.toLowerCase())
  );

  const exactMatch = branches.some(
    (b) => b.toLowerCase() === filterText.trim().toLowerCase()
  );

  const handleCreate = () => {
    if (!filterText.trim()) return;
    onCreateBranch?.(filterText.trim());
    setFilterText("");
    setIsOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs">
      {/* Left: Branch selector & Breadcrumbs */}
      <div className="flex items-center gap-2 flex-wrap" ref={dropdownRef}>
        {/* Branch dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f1524] hover:bg-[#131b2e] text-[#f8fafc] border border-[#1e293b] font-semibold transition-colors shadow-sm"
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span className="max-w-[120px] truncate">{currentBranch || "main"}</span>
            <span className="text-[10px] text-[#94a3b8]">▾</span>
          </button>

          {isOpen && (
            <div className="absolute left-0 mt-1.5 w-72 bg-[#0f1524] border border-[#1e293b] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] bg-[#0a0e17]">
                <span className="font-semibold text-xs text-[#f8fafc]">
                  Switch branches
                </span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[#64748b] hover:text-[#f8fafc] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter Search */}
              <div className="p-2 border-b border-[#1e293b] bg-[#080c14]">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5" />
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Find or create a branch..."
                    autoFocus
                    className="w-full bg-[#0f1524] border border-[#1e293b] rounded-lg pl-8 pr-2 py-1 text-xs text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Branch Items List */}
              <div className="max-h-60 overflow-y-auto divide-y divide-[#161f33]">
                {filteredBranches.length > 0 ? (
                  filteredBranches.map((branch) => {
                    const isCurrent = branch === currentBranch;
                    return (
                      <button
                        key={branch}
                        onClick={() => {
                          onSelectBranch(branch);
                          setIsOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-emerald-500/10 hover:text-emerald-400 transition-colors text-xs ${
                          isCurrent
                            ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                            : "text-[#f8fafc]"
                        }`}
                      >
                        <span className="truncate">{branch}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-3 text-center text-[#7d8590] text-xs">
                    No branches match &ldquo;{filterText}&rdquo;
                  </div>
                )}

                {/* Option to create new branch */}
                {filterText.trim() && !exactMatch && (
                  <button
                    onClick={handleCreate}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs text-cyan-400 hover:bg-cyan-500/10 transition-colors border-t border-[#1e293b]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      Create branch:{" "}
                      <strong className="text-white font-mono">
                        {filterText.trim()}
                      </strong>{" "}
                      from {currentBranch}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* View Mode Toggle: Project Codebase vs GitLite Live Working Tree */}
        {onToggleMode && (
          <div className="flex items-center bg-[#0f1524] border border-[#1e293b] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => onToggleMode("project")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "project"
                  ? "bg-[#0a0e17] text-cyan-400 shadow-sm font-semibold"
                  : "text-[#64748b] hover:text-[#f8fafc]"
              }`}
              title="View full GitLite Java source files"
            >
              Repository
            </button>
            <button
              onClick={() => onToggleMode("snapshot")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "snapshot"
                  ? "bg-[#0a0e17] text-emerald-400 shadow-sm font-semibold"
                  : "text-[#64748b] hover:text-[#f8fafc]"
              }`}
              title="View GitLite active working tree snapshot"
            >
              Live Snapshot
            </button>
          </div>
        )}

        {/* Breadcrumb Path if inside directory */}
        {pathBreadcrumbs.length > 0 && (
          <div className="flex items-center gap-1 text-cyan-400 text-xs font-mono font-medium">
            <button
              onClick={() => onNavigateBreadcrumb?.(-1)}
              className="hover:text-emerald-400 flex items-center gap-0.5 transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>GitLite</span>
            </button>
            {pathBreadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb}>
                <span className="text-[#475569]">/</span>
                <button
                  onClick={() => onNavigateBreadcrumb?.(idx)}
                  className={`transition-colors hover:text-emerald-400 ${
                    idx === pathBreadcrumbs.length - 1
                      ? "text-[#f8fafc] font-bold"
                      : ""
                  }`}
                >
                  {crumb}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Branch count */}
      <div className="flex items-center gap-3 text-xs text-[#64748b]">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
        >
          <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-[#f8fafc]">{branches.length}</span>{" "}
          branches
        </button>
      </div>
    </div>
  );
}
