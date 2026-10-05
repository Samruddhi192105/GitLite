"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitLiteLogo } from "./icons/GitLiteLogo";
import {
  LogOut,
  Terminal,
  Moon,
  Sun,
} from "lucide-react";

interface HeaderProps {
  onToggleTerminal?: () => void;
  terminalOpen?: boolean;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  userName: string;
  repositoryName: string;
}

export default function Header({
  onToggleTerminal,
  terminalOpen,
  theme,
  onToggleTheme,
  userName,
  repositoryName,
}: HeaderProps) {
  const router = useRouter();
  const [signOutError, setSignOutError] = React.useState("");

  const handleSignOut = async () => {
    setSignOutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setSignOutError("Unable to sign out. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("Unable to sign out. Check your connection and try again.");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0a0e17]/90 backdrop-blur-md border-b border-[#1e293b] px-4 py-2.5 text-[#f8fafc] text-sm select-none transition-colors">
      <div className="max-w-[1520px] mx-auto flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Navigation */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group"
            title="GitLite"
          >
            <GitLiteLogo className="w-8 h-8 group-hover:scale-105 transition-transform" />
            <span className="font-bold text-base tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400">
              GitLite
            </span>
          </Link>

          {/* Org & Project Tag */}
          <div className="hidden md:flex items-center gap-2 text-xs bg-[#0f1524] border border-[#1e293b] rounded-lg px-2.5 py-1 text-[#94a3b8]">
            <span className="text-[#64748b]">repo:</span>
            <span className="text-[#f8fafc] font-medium font-mono">
              {userName}/{repositoryName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
          </div>

        </div>

        <div className="flex-1">
          <Link
            href="/dashboard"
            className="hidden w-fit rounded-lg border border-[#1e293b] bg-[#0f1524] px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-400/30 hover:text-emerald-200 md:inline-flex"
          >
            Repositories
          </Link>
        </div>

        {/* Right Side Tools & User Profile */}
        <div className="flex items-center gap-2">
          {/* GitLite CLI Terminal Quick Toggle */}
          <button
            onClick={onToggleTerminal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              terminalOpen
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                : "bg-[#0f1524] hover:bg-[#131b2e] text-[#f8fafc] border-[#1e293b] hover:border-[#334155]"
            }`}
            title="Toggle GitLite CLI Interactive Console"
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline font-mono">CLI Console</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:inline" />
          </button>

          {/* Theme Switcher */}
          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg bg-[#0f1524] text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#131b2e] border border-[#1e293b] transition-colors"
            title="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          <span className="hidden text-xs text-slate-400 md:inline">{userName}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0f1524] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-rose-400/30 hover:text-rose-300"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>

        </div>
      </div>
      {signOutError && (
        <p role="alert" className="mx-auto max-w-7xl pb-2 text-right text-xs text-rose-300">
          {signOutError}
        </p>
      )}
    </header>
  );
}
