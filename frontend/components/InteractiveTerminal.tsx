"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, X, Minimize2, Maximize2, Trash2, CornerDownLeft } from "lucide-react";

interface TerminalProps {
  repositoryId: string;
  onClose?: () => void;
  onCommandSuccess?: () => void;
  isDocked?: boolean;
}

interface CommandHistoryItem {
  command: string;
  output: string;
  isError?: boolean;
  time: string;
}

export default function InteractiveTerminal({
  repositoryId,
  onClose,
  onCommandSuccess,
  isDocked = true,
}: TerminalProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [commandList, setCommandList] = useState<string[]>(["gitlite status"]);
  const [isExpanded, setIsExpanded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const runCommand = async (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    if (trimmed === "clear") {
      setHistory([]);
      setInput("");
      return;
    }

    if (trimmed === "help") {
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: `GitLite Available Commands:
  gitlite status             - Show status of working tree and staging
  gitlite add <file>         - Stage a file (e.g. gitlite add working/login.txt)
  gitlite commit "<message>" - Create a commit with message
  gitlite log                - View commit history with hashes
  gitlite branches           - List repository branches
  gitlite branch <name>      - Create a new branch
  gitlite switch <name>      - Switch to branch and restore files
  gitlite checkout <id>      - Checkout commit snapshot
  clear                      - Clear terminal output
  help                       - Show this help menu`,
          time: new Date().toLocaleTimeString(),
        },
      ]);
      setInput("");
      return;
    }

    setLoading(true);
    setCommandList((prev) => [trimmed, ...prev]);
    setHistoryIndex(-1);

    try {
      const res = await fetch("/api/gitlite/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exec", command: trimmed, repoId: repositoryId }),
      });
      const data = await res.json();

      let output = "";
      if (data.stdout) output += data.stdout;
      if (data.stderr) output += (output ? "\n" : "") + data.stderr;
      if (!output) output = data.success ? "Command executed successfully." : (data.error || "No output.");

      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: output.trim(),
          isError: !data.success,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      if (data.success) {
        onCommandSuccess?.();
      }
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: err.message || "Failed to execute command",
          isError: true,
          time: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
      setInput("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandList.length > 0 && historyIndex < commandList.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInput(commandList[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIdx = historyIndex - 1;
        setHistoryIndex(prevIdx);
        setInput(commandList[prevIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  const quickChips = [
    "gitlite status",
    "gitlite log",
    "gitlite branches",
    "help",
  ];

  return (
    <div
      className={`bg-[#0d1117] border border-[#30363d] rounded-md shadow-2xl flex flex-col overflow-hidden text-xs font-mono transition-all duration-200 ${
        isDocked
          ? `w-full ${isExpanded ? "h-[500px]" : "h-72"}`
          : "w-full max-w-4xl mx-auto h-[480px]"
      }`}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d] select-none text-[#7d8590]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#3fb950]" />
          <span className="font-semibold text-[#e6edf3]">
            GitLite Repository Console
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setHistory([])}
            className="p-1 hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
            title="Clear output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:text-[#e6edf3] hover:bg-[#21262d] rounded transition-colors"
            title={isExpanded ? "Restore size" : "Maximize"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:text-[#f85149] hover:bg-[#21262d] rounded transition-colors"
              title="Close terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#161b22]/70 border-b border-[#21262d] overflow-x-auto text-[11px] scrollbar-none">
        <span className="text-[#7d8590] shrink-0 text-[10px] font-sans">Quick:</span>
        {quickChips.map((chip) => (
          <button
            key={chip}
            onClick={() => runCommand(chip)}
            className="shrink-0 px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#58a6ff] hover:text-[#79c0ff] border border-[#30363d] transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Terminal History Output */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 leading-relaxed">
        {history.length === 0 && (
          <p className="text-[#7d8590]">Run <span className="text-[#3fb950]">help</span> to see available GitLite commands.</p>
        )}
        {history.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center gap-2 text-[#7d8590]">
              <span className="text-[#3fb950] font-bold">gitlite@workspace:~/GitLite$</span>
              <span className="text-[#e6edf3] font-semibold">{item.command}</span>
            </div>
            <pre
              className={`p-2 rounded bg-[#161b22]/60 whitespace-pre-wrap ${
                item.isError ? "text-[#f85149] border-l-2 border-[#f85149]" : "text-[#7ee787]"
              }`}
            >
              {item.output}
            </pre>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[#7d8590] italic">
            <span className="w-2 h-2 rounded-full bg-[#58a6ff] animate-ping" />
            <span>Executing Java VCS command...</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Terminal Input Line */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#161b22] border-t border-[#30363d]">
        <span className="text-[#3fb950] font-bold select-none shrink-0">
          gitlite@workspace:~/GitLite$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          disabled={loading}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type gitlite command (e.g. gitlite status) or 'help'..."
          className="flex-1 bg-transparent text-[#e6edf3] focus:outline-none placeholder-[#484f58] font-mono text-xs"
        />
        <button
          onClick={() => runCommand(input)}
          disabled={loading || !input.trim()}
          className="p-1 rounded bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 text-white transition-opacity"
          title="Run command (Enter)"
        >
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
