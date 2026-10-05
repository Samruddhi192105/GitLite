"use client";

import React from "react";
import { Code2, Terminal, Layers } from "lucide-react";

export type ActiveTab = "code" | "terminal";

interface RepoHeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  repositoryName: string;
  userName: string;
}

export default function RepoHeader({
  activeTab,
  onTabChange,
  repositoryName,
  userName,
}: RepoHeaderProps) {
  const navTabs: Array<{
    id: ActiveTab;
    label: string;
    icon: typeof Code2;
    badge?: string;
  }> = [
    { id: "code", label: "Explorer & Code", icon: Code2 },
    {
      id: "terminal",
      label: "Interactive CLI",
      icon: Terminal,
      badge: "LIVE",
    },
  ];

  return (
    <div className="bg-[#0a0e17] border-b border-[#1e293b] pt-6 px-4 select-none">
      <div className="max-w-[1520px] mx-auto">
        {/* Repo Title Bar & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
          {/* Repository identity */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Layers className="w-5 h-5" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[#94a3b8] text-sm">{userName}</span>
                <span className="text-[#475569] text-sm">/</span>
                <button
                  type="button"
                  onClick={() => onTabChange("code")}
                  className="text-lg font-bold text-[#f8fafc] hover:text-emerald-400 transition-colors tracking-tight"
                >
                  {repositoryName}
                </button>

              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                Java-backed version control • Filesystem snapshots and branch history
              </p>
            </div>
          </div>

        </div>

        {/* Modern Pill-Segmented Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-2 text-xs">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-500/15 via-cyan-500/10 to-indigo-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm"
                    : "text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#0f1524] border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-emerald-400" : "text-[#64748b]"
                  }`}
                />
                <span>{tab.label}</span>

                {/* Custom badge */}
                {tab.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
