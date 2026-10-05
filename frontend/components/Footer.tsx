"use client";

import React from "react";
import { GitLiteLogo } from "./icons/GitLiteLogo";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[#1e293b] py-10 px-4 text-xs text-[#64748b] select-none">
      <div className="max-w-[1520px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: GitLite Logo & Copyright */}
        <div className="flex items-center gap-3">
          <GitLiteLogo className="w-6 h-6 opacity-60 hover:opacity-100 transition-opacity" />
          <span className="font-mono">© 2026 GitLite Studio · Pure Java VCS Engine</span>
        </div>

      </div>
    </footer>
  );
}
