"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderGit2, LoaderCircle, Plus } from "lucide-react";

interface RepositorySummary {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export default function RepositoryList({ userName }: { userName: string }) {
  const router = useRouter();
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function loadRepositories() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/repositories");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not load repositories.");
      }
      setRepositories(result.repositories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load repositories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRepositories();
  }, []);

  async function createRepository(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not create repository.");
      }
      router.push(`/dashboard/${result.repository.id}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create repository.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080c14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(16,185,129,0.12),transparent_55%)]" />
      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
        <Link href="/" className="flex items-center gap-3 font-semibold text-white">
          <FolderGit2 className="h-6 w-6 text-emerald-300" />
          GitLite repositories
        </Link>
        <span className="text-sm text-slate-400">Signed in as {userName}</span>
      </header>

      <section className="relative z-10 mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-300">Your workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Repositories</h1>
            <p className="mt-2 text-sm text-slate-400">Each repository has its own files, branches, and commit history.</p>
          </div>
          <form onSubmit={createRepository} className="flex w-full max-w-md gap-2">
            <input
              aria-label="New repository name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={1}
              maxLength={60}
              required
              placeholder="Repository name"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0d1320] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {creating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </form>
        </div>

        {error && (
          <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => void loadRepositories()} className="font-medium text-white underline underline-offset-4">
              Retry
            </button>
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d1320]/80">
          {loading ? (
            <p className="p-8 text-center text-sm text-slate-400">Loading repositories…</p>
          ) : repositories.length ? (
            <div className="divide-y divide-white/[0.06]">
              {repositories.map((repository) => (
                <Link
                  key={repository.id}
                  href={`/dashboard/${repository.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-5 transition hover:bg-white/[0.025]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] text-emerald-300">
                      <FolderGit2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-white">{repository.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        Created {new Date(repository.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-500" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-6 py-14 text-center">
              <FolderGit2 className="mx-auto h-9 w-9 text-slate-600" />
              <h2 className="mt-4 font-medium text-white">No repositories yet</h2>
              <p className="mt-1 text-sm text-slate-400">Create your first repository to start committing changes.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
