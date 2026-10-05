import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, GitBranch, History, ShieldCheck, Terminal } from "lucide-react";
import { GitLiteLogo } from "@/components/icons/GitLiteLogo";
import { getAuthSession } from "@/lib/auth";

const features = [
  {
    icon: Boxes,
    title: "Snapshots that stay immutable",
    description: "Save complete project states as content-addressed snapshots, protected by SHA-256 hashes.",
  },
  {
    icon: GitBranch,
    title: "Branches for experiments",
    description: "Create branches and switch between lines of work without losing your place.",
  },
  {
    icon: History,
    title: "A clear commit history",
    description: "Review past commits, browse their files, and check out a previous snapshot.",
  },
  {
    icon: Terminal,
    title: "Your workflow, in one place",
    description: "Stage files, write a commit, and run GitLite commands from the browser dashboard.",
  },
];

export default function LandingPage() {
  if (getAuthSession()) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080c14] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(16,185,129,0.16),transparent_55%),radial-gradient(ellipse_at_90%_40%,rgba(6,182,212,0.08),transparent_35%)]" />
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="GitLite home">
          <GitLiteLogo className="h-10 w-10" />
          <span className="text-xl font-bold tracking-tight">GitLite</span>
          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 font-mono text-[10px] font-semibold tracking-widest text-emerald-300">
            VCS
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:text-white">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-emerald-300/20 bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-32 lg:pt-24">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-1.5 text-xs text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            A lightweight version control system, built in Java
          </div>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Your code.
            <br />
            Your history.
            <br />
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              Kept simple.
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
            GitLite brings commits, branches, and immutable project snapshots into a focused workspace.
            Understand your project history and keep moving without the clutter.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-emerald-950/30 transition hover:-translate-y-0.5 hover:bg-emerald-300"
            >
              Create your account
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]">
              Sign in
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Private account credentials stored securely
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-indigo-400/15 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0d1320]/90 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <span className="font-mono text-[11px] text-slate-500">gitlite · project history</span>
            </div>
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">A calmer way to track change</p>
                  <p className="mt-1 text-xs text-slate-500">Java VCS · SHA-256 snapshots</p>
                </div>
                <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1.5 font-mono text-[10px] text-emerald-300">main</span>
              </div>
              <div className="relative space-y-0 border-l border-slate-700/80 pl-6">
                {[
                  ["Just now", "Add project documentation", "a84d20e"],
                  ["2 hours ago", "Create initial snapshot", "f31c8a2"],
                  ["Yesterday", "Start a new project", "c08b671"],
                ].map(([time, message, id], index) => (
                  <div key={id} className="relative pb-7 last:pb-0">
                    <span className={`absolute -left-[30px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-[#0d1320] ${index === 0 ? "bg-emerald-400" : "bg-slate-600"}`} />
                    <p className="text-sm font-medium text-slate-200">{message}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                      <span>{time}</span>
                      <span>·</span>
                      <span className="font-mono text-cyan-300/80">{id}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                  <GitBranch className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Work on a branch</p>
                  <p className="mt-1 text-[11px] text-slate-500">Switch, explore, and return with confidence.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 border-t border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-300">About GitLite</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Version control fundamentals, made approachable.
            </h2>
            <p className="mt-4 leading-7 text-slate-400">
              GitLite is a Java-based VCS project that demonstrates how source control works under the hood:
              a staging index, commit history, branch pointers, and content-addressed snapshots. Its dashboard
              lets you explore those concepts through your own repository.
            </p>
          </div>
          <div id="features" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-white/[0.07] bg-[#0d1320]/75 p-5">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-6 text-center text-xs text-slate-500">
        GitLite Studio · Java VCS Engine
      </footer>
    </main>
  );
}
