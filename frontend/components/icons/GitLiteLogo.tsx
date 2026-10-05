import React from "react";

export function GitLiteLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="gl-grad-1" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="0.5" stopColor="#06b6d4" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="gl-grad-glow" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" stopOpacity="0.4" />
          <stop offset="1" stopColor="#6366f1" stopOpacity="0.1" />
        </linearGradient>
        <filter id="gl-shadow" x="0" y="0" width="40" height="40" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Rounded Hexagon / Diamond background badge */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="10"
        fill="#0f172a"
        stroke="url(#gl-grad-1)"
        strokeWidth="1.5"
      />

      {/* Subtle inner ambient fill */}
      <rect
        x="3"
        y="3"
        width="34"
        height="34"
        rx="9"
        fill="url(#gl-grad-glow)"
      />

      {/* Interconnecting GitLite Branch Tracks */}
      <path
        d="M13 28V12"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 20C17 20 18 14 24 14H27"
        stroke="#06b6d4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 24C18 24 20 28 26 28H27"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Root Node */}
      <circle cx="13" cy="28" r="3" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />

      {/* Trunk Commit Node */}
      <circle cx="13" cy="12" r="3" fill="#6366f1" stroke="#0f172a" strokeWidth="1.5" />

      {/* Feature Branch 1 Node */}
      <circle cx="27" cy="14" r="3" fill="#06b6d4" stroke="#0f172a" strokeWidth="1.5" />

      {/* Feature Branch 2 Node */}
      <circle cx="27" cy="28" r="3" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
    </svg>
  );
}

export function BranchNodeBadge({ name = "main" }: { name?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      <span>{name}</span>
    </span>
  );
}
