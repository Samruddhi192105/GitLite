"use client";

import React from "react";
import { Cpu } from "lucide-react";

interface SidebarAboutProps {
  repositoryName: string;
  currentBranch?: string;
  totalCommits: number;
  initialized: boolean;
}

export default function SidebarAbout({
  repositoryName,
  currentBranch = "main",
  totalCommits,
  initialized,
}: SidebarAboutProps) {
  return (
    <div className="w-full lg:w-80 shrink-0 space-y-6 text-xs text-[#94a3b8]">
      <div className="p-5 rounded-xl bg-[#0f1524] border border-[#1e293b] shadow-lg shadow-black/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-[#f8fafc] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Repository details</span>
          </h3>
        </div>

        <p className="text-sm font-medium text-white">{repositoryName}</p>
        <p className="mt-1 text-xs text-[#94a3b8]">Private to its owner</p>
        <div className="mt-4 space-y-2.5 border-t border-[#1e293b] pt-4 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#64748b]">Repository state</span>
            <span className={initialized ? "text-emerald-400" : "text-amber-300"}>
              {initialized ? "Initialized" : "Not initialized"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748b]">Current branch</span>
            <span className="text-[#f8fafc] font-mono font-semibold bg-[#0a0e17] px-2 py-0.5 rounded border border-[#1e293b]">
              {currentBranch}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#64748b]">Commits</span>
            <span className="text-[#cbd5e1] font-mono">{totalCommits}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
