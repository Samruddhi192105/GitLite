"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { GitLiteLogo } from "@/components/icons/GitLiteLogo";

interface AuthFormProps {
  mode: "login" | "signup";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Authentication failed. Please try again.");
        return;
      }

      if (isSignup) {
        setSignupComplete(true);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to reach GitLite. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080c14] px-5 py-12 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(16,185,129,0.15),transparent_48%),radial-gradient(ellipse_at_100%_100%,rgba(6,182,212,0.08),transparent_40%)]" />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to GitLite
        </Link>
        <section className="rounded-2xl border border-white/10 bg-[#0d1320]/90 p-7 shadow-2xl shadow-black/40 backdrop-blur sm:p-9">
          {signupComplete ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-300" />
              <h1 className="text-2xl font-semibold tracking-tight text-white">Signed up successfully!</h1>
              <p role="status" className="mt-3 text-sm leading-6 text-slate-400">
                Your account has been created. Please sign in to proceed to your GitLite dashboard.
              </p>
              <Link
                href="/login"
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Sign in to continue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7 flex flex-col items-center text-center">
                <GitLiteLogo className="mb-4 h-12 w-12" />
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  {isSignup ? "Create your account" : "Welcome back"}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  {isSignup ? "Join GitLite and open your project workspace." : "Sign in to continue to your GitLite workspace."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-300">Name</span>
                <span className="relative block">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-lg border border-white/10 bg-[#080c14] py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10"
                  />
                </span>
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Email</span>
              <span className="relative block">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoComplete="email"
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-white/10 bg-[#080c14] py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">Password</span>
              <span className="relative block">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  type="password"
                  required
                  minLength={isSignup ? 8 : undefined}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isSignup ? "At least 8 characters" : "Your password"}
                  className="w-full rounded-lg border border-white/10 bg-[#080c14] py-3 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/10"
                />
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-400">
                {isSignup ? "Already have an account?" : "New to GitLite?"}{" "}
                <Link
                  href={isSignup ? "/login" : "/signup"}
                  className="font-medium text-emerald-300 transition hover:text-emerald-200"
                >
                  {isSignup ? "Sign in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
        </section>
        <p className="mt-5 text-center text-xs text-slate-600">GitLite · Your code, your history.</p>
      </div>
    </main>
  );
}
