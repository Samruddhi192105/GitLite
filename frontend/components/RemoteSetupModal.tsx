"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, ShieldAlert, X } from "lucide-react";

interface RemoteSetupModalProps {
  repositoryId: string;
  repositorySlug: string;
  onClose: () => void;
}

export default function RemoteSetupModal({
  repositoryId,
  repositorySlug,
  onClose,
}: RemoteSetupModalProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const remoteUrl = `${typeof window === "undefined" ? "" : window.location.origin}/api/remotes/${repositoryId}`;
  const cliPath = "$env:GITLITE_CLI = 'D:\\path\\to\\GitLite\\gitlite.bat'";
  const instructions = `${cliPath}\n$env:GITLITE_TOKEN = '${token || "<generate-a-token-first>"}'\n& $env:GITLITE_CLI clone '${remoteUrl}' \"$HOME\\${repositorySlug}\"\nSet-Location \"$HOME\\${repositorySlug}\"\n& $env:GITLITE_CLI pull`;

  async function generateToken() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/token`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create an access token.");
      setToken(result.token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create an access token.");
    } finally {
      setLoading(false);
    }
  }

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard. Select and copy the commands manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-setup-title"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117] text-[#e6edf3] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#30363d] px-5 py-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-emerald-400" />
            <h2 id="remote-setup-title" className="font-semibold">Connect a local GitLite CLI</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-[#7d8590] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-[#94a3b8]">
            Create a private token to clone, pull, and push this repository from your laptop. The token is shown only once; generating another will invalidate the previous one.
          </p>
          {!token ? (
            <button
              onClick={() => void generateToken()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Generate CLI token
            </button>
          ) : (
            <>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-200">
                <div className="flex gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <p>Copy this token now and keep it secret. It cannot be retrieved after you close this dialog.</p>
                </div>
                <code className="mt-2 block break-all rounded bg-black/20 p-2 font-mono text-xs">{token}</code>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-[#94a3b8]">
                  <span>PowerShell commands</span>
                  <button onClick={() => void copyInstructions()} className="inline-flex items-center gap-1 text-emerald-300 hover:text-white">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-[#30363d] bg-[#010409] p-3 font-mono text-xs leading-6 text-[#c9d1d9]">{instructions}</pre>
                <p className="mt-2 text-xs text-[#7d8590]">Replace the CLI path with your local GitLite checkout. The 20 MB sync limit applies; push and pull require a clean working tree.</p>
              </div>
            </>
          )}
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        </div>
      </section>
    </div>
  );
}
