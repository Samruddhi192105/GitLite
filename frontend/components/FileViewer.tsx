"use client";

import React, { useState } from "react";
import { Copy, Check, Download, ArrowLeft, Eye, Pencil, Save, X, Trash2, FilePenLine } from "lucide-react";

interface FileViewerProps {
  file: {
    name: string;
    path: string;
    size: number;
    lineCount: number;
    content: string;
    lines: string[];
    isBinary: boolean;
    lastModified?: string;
  };
  onBack: () => void;
  repositoryId: string;
  canEdit: boolean;
  mode: "project" | "snapshot";
  commitId?: string;
  onMutation: (path?: string) => void;
}

export default function FileViewer({
  file,
  onBack,
  repositoryId,
  canEdit,
  mode,
  commitId,
  onMutation,
}: FileViewerProps) {
  const [copied, setCopied] = useState(false);
  const [rawView, setRawView] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(file.content);
  const [renaming, setRenaming] = useState(false);
  const [newPath, setNewPath] = useState(file.path);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const runFileAction = async (action: string, values: Record<string, string>) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/gitlite/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, repoId: repositoryId, ...values }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.stderr || "File operation failed.");
      onMutation(action === "renameFile" ? values.newPath : action === "editFile" ? file.path : undefined);
      setIsEditing(false);
      setRenaming(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "File operation failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      let blob: Blob;
      if (file.isBinary) {
        const query = new URLSearchParams({
          path: file.path,
          mode,
          isFile: "true",
          download: "true",
          repoId: repositoryId,
        });
        if (commitId) query.set("commitId", commitId);
        const response = await fetch(`/api/gitlite/files?${query.toString()}`);
        if (!response.ok) throw new Error("Could not download this file.");
        blob = await response.blob();
      } else {
        blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not download this file.");
    }
  };

  // Basic syntax colorizer for Java, TS, JSON, Markdown
  const highlightLine = (line: string, ext: string) => {
    if (!line) return " ";

    if (ext === "java" || ext === "ts" || ext === "js") {
      // Comments
      if (line.trim().startsWith("//") || line.trim().startsWith("/*") || line.trim().startsWith("*")) {
        return <span className="text-[#8b949e] italic">{line}</span>;
      }
      // Simple token replacement for keywords
      const tokens = line.split(/(\b(?:public|private|protected|class|interface|void|int|boolean|String|new|return|if|else|switch|case|break|default|import|package|static|final|try|catch|throws|throw)\b|".*?"|'.*?'|\d+)/g);

      return (
        <span>
          {tokens.map((token, i) => {
            if (/^(public|private|protected|class|interface|void|int|boolean|String|new|return|if|else|switch|case|break|default|import|package|static|final|try|catch|throws|throw)$/.test(token)) {
              return <span key={i} className="text-[#ff7b72] font-semibold">{token}</span>;
            }
            if (token.startsWith('"') || token.startsWith("'")) {
              return <span key={i} className="text-[#a5d6ff]">{token}</span>;
            }
            if (/^\d+$/.test(token)) {
              return <span key={i} className="text-[#79c0ff]">{token}</span>;
            }
            return <span key={i} className="text-[#e6edf3]">{token}</span>;
          })}
        </span>
      );
    }

    return <span className="text-[#e6edf3]">{line}</span>;
  };

  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  return (
    <div className="border border-[#30363d] rounded-md bg-[#0d1117] overflow-hidden my-4">
      {/* File Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] text-xs">
        {/* Left: Back button & File details */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[#58a6ff] hover:underline font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="text-[#7d8590]">|</span>
          <span className="font-semibold text-[#e6edf3] font-mono">{file.path}</span>
          <span className="text-[#7d8590]">
            {file.lineCount} lines ({file.lineCount} loc) · {(file.size / 1024).toFixed(2)} KB
          </span>
        </div>

        {/* File actions */}
        <div className="flex items-center gap-1.5">
          {canEdit && !file.isBinary && !isEditing && !renaming && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 rounded border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-[#c9d1d9] hover:bg-[#30363d]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => { setNewPath(file.path); setRenaming(true); }}
                className="flex items-center gap-1 rounded border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-[#c9d1d9] hover:bg-[#30363d]"
              >
                <FilePenLine className="h-3.5 w-3.5" />
                Rename
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Delete ${file.path}? This stages the deletion for the next commit.`)) {
                    void runFileAction("deleteFile", { filePath: file.path });
                  }
                }}
                className="flex items-center gap-1 rounded border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </>
          )}
          {!file.isBinary && (
            <>
              <button
                onClick={() => setRawView(!rawView)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-[#7d8590]" />
                <span>{rawView ? "Preview" : "Raw"}</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-colors"
                title="Copy raw file contents"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#2ea043]" />
                    <span className="text-[#2ea043]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#7d8590]" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            className="p-1 rounded bg-[#21262d] hover:bg-[#30363d] text-[#7d8590] hover:text-[#e6edf3] border border-[#30363d] transition-colors"
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && <p role="alert" className="border-b border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-300">{error}</p>}
      {renaming && (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-[#30363d] bg-[#161b22] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runFileAction("renameFile", { filePath: file.path, newPath });
          }}
        >
          <label className="text-[#94a3b8]" htmlFor="rename-path">New path</label>
          <input
            id="rename-path"
            value={newPath}
            onChange={(event) => setNewPath(event.target.value)}
            className="min-w-0 flex-1 rounded border border-[#30363d] bg-[#0d1117] px-2 py-1 font-mono text-[#e6edf3]"
          />
          <button disabled={saving} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-50">Rename</button>
          <button type="button" onClick={() => setRenaming(false)} className="flex items-center gap-1 text-[#94a3b8]">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </form>
      )}

      {/* Code Viewer Body */}
      {file.isBinary ? (
        <div className="px-4 py-10 text-center text-sm text-[#94a3b8]">
          <p>This is a binary file and cannot be previewed or edited in the browser.</p>
          <p className="mt-1 text-xs text-[#7d8590]">Use Download to save the original file.</p>
        </div>
      ) : isEditing ? (
        <div className="space-y-3 p-4">
          <textarea
            aria-label={`Edit ${file.path}`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
            className="min-h-[360px] w-full resize-y rounded border border-[#30363d] bg-[#0d1117] p-3 font-mono text-xs leading-5 text-[#e6edf3] outline-none focus:border-emerald-500"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setContent(file.content); setIsEditing(false); }} className="flex items-center gap-1 rounded border border-[#30363d] px-3 py-1.5 text-[#c9d1d9]">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
            <button
              disabled={saving}
              onClick={() => void runFileAction("editFile", { filePath: file.path, content })}
              className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : rawView ? (
        <pre className="p-4 font-mono text-xs text-[#e6edf3] overflow-x-auto whitespace-pre">
          {content}
        </pre>
      ) : (
        <div className="overflow-x-auto font-mono text-xs leading-5">
          <table className="w-full border-collapse">
            <tbody>
              {content.split("\n").map((line, idx) => {
                const lineNum = idx + 1;
                return (
                  <tr key={idx} className="hover:bg-[#161b22] group">
                    {/* Line number gutter */}
                    <td className="w-12 text-right pr-4 pl-3 select-none text-[#484f58] group-hover:text-[#7d8590] bg-[#0d1117] border-r border-[#21262d]">
                      {lineNum}
                    </td>
                    {/* Line content */}
                    <td className="pl-4 pr-4 whitespace-pre py-0.5 font-mono">
                      {highlightLine(line, ext)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
