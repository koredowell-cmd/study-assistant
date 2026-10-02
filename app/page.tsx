"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { PLANS, cedis, type PlanId } from "@/lib/plans";

const STORAGE_KEY = "study-assistant-output";

const SECTION_NAMES = [
  "OVERVIEW",
  "DETAILED STUDY NOTES",
  "KEY TERMS",
  "COMPARISONS",
  "PRACTICE QUESTIONS",
];

const ALIASES: Record<string, string> = {
  SUMMARY: "OVERVIEW",
  "STUDY NOTES": "DETAILED STUDY NOTES",
  "DETAILED NOTES": "DETAILED STUDY NOTES",
  "KEY TERMS AND DEFINITIONS": "KEY TERMS",
  "KEY TERMS & DEFINITIONS": "KEY TERMS",
  COMPARISON: "COMPARISONS",
  "PRACTICE QUESTIONS AND ANSWERS": "PRACTICE QUESTIONS",
};

const TITLES: Record<string, string> = {
  OVERVIEW: "Overview",
  "DETAILED STUDY NOTES": "Detailed study notes",
  "KEY TERMS": "Key terms",
  COMPARISONS: "Comparisons",
  "PRACTICE QUESTIONS": "Practice questions",
  NOTES: "Notes",
};

type Section = { title: string; lines: string[] };
type Pass = {
  id: string;
  plan: string;
  uploads_total: number;
  uploads_used: number;
  expires_at: string;
};

function toTitle(text: string) {
  return text.toLowerCase().replace(/(^|\s)[a-z]/g, (c) => c.toUpperCase());
}

function matchSection(line: string): string | null {
  const clean = line
    .replace(/[*#:_`]/g, "")
    .replace(/^\s*(section\s*)?\d+[.)]?\s*/i, "")
    .replace(/^[-–—•]\s*/, "")
    .trim()
    .toUpperCase();
  if (SECTION_NAMES.includes(clean)) return clean;
  return ALIASES[clean] ?? null;
}

function parseSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const raw of text.split("\n")) {
    const name = matchSection(raw);
    if (name) {
      current = { title: name, lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "NOTES", lines: [] };
      sections.push(current);
    }
    current.lines.push(raw.replace(/\*\*/g, ""));
  }
  return sections.filter((s) => s.lines.some((l) => l.trim() !== ""));
}

function isHeading(line: string) {
  const t = line.trim();
  return t.length > 2 && t.length < 80 && t === t.toUpperCase() && /[A-Z]{3}/.test(t);
}

function renderLine(line: string, title: string, i: number) {
  const t = line.trim().replace(/^[-•]\s*/, "");
  if (t === "") return <div key={i} className="h-2" />;

  if (/^part [abc]/i.test(t)) {
    return (
      <h4
        key={i}
        className="mt-7 border-b border-line pb-1 font-serif text-base font-semibold text-leaf-dark"
      >
        {t}
      </h4>
    );
  }

  if (isHeading(t)) {
    return (
      <h3 key={i} className="mt-6 font-serif text-lg font-semibold text-ink">
        {toTitle(t)}
      </h3>
    );
  }

  const answer = t.match(/^answer\s*:\s*(.*)$/i);
  if (answer) {
    return (
      <p
        key={i}
        className="mt-1.5 rounded-r-md border-l-2 border-leaf bg-leaf-tint px-3 py-1.5 text-leaf-dark"
      >
        <span className="font-semibold">Answer:</span> {answer[1]}
      </p>
    );
  }

  if (title === "KEY TERMS") {
    const term = t.match(/^([^:]{2,60}):\s*(.+)$/);
    if (term) {
      return (
        <p key={i} className="mt-3">
          <span className="font-semibold text-ink">{term[1]}:</span> {term[2]}
        </p>
      );
    }
  }

  return (
    <p key={i} className="mt-1.5">
      {t}
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-muted/60 focus:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf/30";

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <svg
        className="h-10 w-10 shrink-0"
        viewBox="0 0 64 64"
        role="img"
        aria-label="ACE logo"
      >
        <rect width="64" height="64" rx="14" fill="#0f6b4f" />
        <polyline
          points="16,51 32,13 48,51"
          fill="none"
          stroke="#f5b700"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="23,39 31,46 47,27"
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="leading-none">
        <span className="block font-serif text-xl font-black text-white">ACE</span>
        <span className="mt-1 block text-xs text-white/70">Study Buddy</span>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      className="mt-1 h-4 w-4 shrink-0 text-gold"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M4 10.5l4 4 8-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  const [passes, setPasses] = useState<Pass[]>([]);
  const [payBusy, setPayBusy] = useState("");
  const [showPlans, setShowPlans] = useState(false);

  const userId = session?.user.id;
  const busy = status !== "";

  const loadPasses = useCallback(async () => {
    const { data } = await supabase
      .from("passes")
      .select("id, plan, uploads_total, uploads_used, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });
    setPasses((data ?? []).filter((p) => p.uploads_used < p.uploads_total));
  }, []);

  const verifyPayment = useCallback(
    async (reference: string) => {
      setNotice("Confirming your payment...");
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please log in to continue.");

        const res = await fetch("/api/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reference }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not confirm the payment.");

        setNotice("Payment received. Your pass is active.");
        setShowPlans(false);
        setError("");
        await loadPasses();
      } catch (err) {
        setNotice("");
        setError(
          err instanceof Error
            ? err.message
            : "Could not confirm the payment. If you were charged, contact support."
        );
      }
    },
    [loadPasses]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setOutput("");
      setPasses([]);
      setShowPlans(false);
      return;
    }
    try {
      setOutput(localStorage.getItem(`${STORAGE_KEY}-${userId}`) ?? "");
    } catch {}

    loadPasses();

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    if (reference) {
      window.history.replaceState({}, "", window.location.pathname);
      verifyPayment(reference);
    }
  }, [userId, loadPasses, verifyPayment]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMsg("");
    const { error: authError } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (authError) setAuthMsg(authError.message);
    setAuthBusy(false);
  }

  async function logOut() {
    await supabase.auth.signOut();
    setError("");
    setNotice("");
  }

  function clearNotes() {
    setOutput("");
    try {
      if (userId) localStorage.removeItem(`${STORAGE_KEY}-${userId}`);
    } catch {}
  }

  async function copyNotes() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Try the Download button instead.");
    }
  }

  function downloadNotes() {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-notes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function buyPass(plan: PlanId) {
    setError("");
    setNotice("");
    setPayBusy(plan);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please log in to continue.");

      const res = await fetch("/api/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start the payment.");

      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the payment.");
      setPayBusy("");
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setNotice("");
    setOutput("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Please log in to continue.");

      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File is too large. Please use a PDF under 50MB.");
      }

      setStatus("Reading your slides...");
      const { extractText, getDocumentProxy } = await import("unpdf");
      const buffer = await file.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });

      if (text.trim().length < 50) {
        throw new Error(
          "Could not find readable text in this PDF. It may be scanned images."
        );
      }

      setStatus("Writing your study notes and questions. This can take up to a minute...");
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.slice(0, 60000) }),
      });
      const data = await res.json();
      if (res.status === 429) setShowPlans(true);
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");

      setOutput(data.output);
      try {
        localStorage.setItem(`${STORAGE_KEY}-${sessionData.session?.user.id}`, data.output);
      } catch {}
      loadPasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
    setStatus("");
  }

  const sections = output ? parseSections(output) : [];
  const uploadsLeft = passes.reduce((n, p) => n + (p.uploads_total - p.uploads_used), 0);
  const lastExpiry = passes.length
    ? new Date(Math.max(...passes.map((p) => new Date(p.expires_at).getTime())))
    : null;

  if (!authReady) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-white/70">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div className="enter">
          <Brand />
          <h1 className="mt-8 font-serif text-4xl font-bold leading-[1.1] text-white sm:text-6xl">
            Turn your slides into exam prep
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-8 text-white/75">
            Upload a lecture PDF and get study notes, key terms, and practice
            questions with answers.
          </p>

          <ul className="mt-6 space-y-2.5 text-white/90">
            <li className="flex gap-3">
              <Check />
              Notes on every topic in your slides
            </li>
            <li className="flex gap-3">
              <Check />
              Practice questions with the answers included
            </li>
            <li className="flex gap-3">
              <Check />
              Pay with Mobile Money, only when you need more
            </li>
          </ul>

          <ul className="mt-6 flex flex-wrap gap-2 text-sm">
            <li className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
              Free: 2 uploads a day
            </li>
            <li className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
              {PLANS.week.name} GH₵{cedis(PLANS.week.pesewas)}
            </li>
            <li className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90">
              {PLANS.month.name} GH₵{cedis(PLANS.month.pesewas)}
            </li>
          </ul>
        </div>

        <div className="enter enter-2 w-full max-w-md lg:justify-self-end">
          <form
            onSubmit={handleAuth}
            className="space-y-4 rounded-2xl bg-white p-6 text-ink shadow-2xl"
          >
            <h2 className="font-serif text-2xl font-semibold">
              {mode === "signup" ? "Create your account" : "Log in"}
            </h2>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            {authMsg && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {authMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded-lg bg-leaf px-4 py-3 font-semibold text-white hover:bg-leaf-dark disabled:opacity-60"
            >
              {authBusy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setAuthMsg("");
              }}
              className="text-sm font-medium text-leaf underline underline-offset-2"
            >
              {mode === "login"
                ? "New here? Create an account"
                : "Already have an account? Log in"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-16 pt-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Brand />
        <div className="flex min-w-0 items-center gap-2 text-sm text-white/70">
          <span className="truncate">{session.user.email}</span>
          <button
            onClick={logOut}
            className="shrink-0 rounded-md px-2 py-1 font-medium text-white hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-14">
        <div>
          <div className="enter">
            <h1 className="font-serif text-4xl font-bold leading-[1.1] text-white sm:text-5xl">
              Turn your slides into exam prep
            </h1>
            <p className="mt-3 max-w-md leading-7 text-white/75">
              Upload a lecture PDF and get study notes, key terms, and practice
              questions with answers.
            </p>
          </div>

          <label
            className={`ruled enter enter-2 mt-6 block cursor-pointer rounded-2xl py-7 pl-16 pr-6 text-ink shadow-2xl focus-within:ring-2 focus-within:ring-gold ${
              busy ? "pointer-events-none opacity-70" : ""
            }`}
          >
            <span className="block font-serif text-xl font-semibold">
              Choose a lecture PDF
            </span>
            <span className="mt-1 block text-sm leading-6 text-muted">
              Slides or notes saved as a PDF. Scanned pages cannot be read.
            </span>
            <span className="glow mt-4 inline-block rounded-lg bg-leaf px-5 py-2.5 text-sm font-semibold text-white">
              Select PDF
            </span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={handleFile}
              disabled={busy}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            {passes.length > 0 && lastExpiry ? (
              <span className="rounded-full bg-gold-tint px-3 py-1 font-medium text-ink">
                Pass active: {uploadsLeft} uploads left, until{" "}
                {lastExpiry.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
              </span>
            ) : (
              <span className="text-white/70">Free plan: 2 uploads a day</span>
            )}
            <button
              onClick={() => setShowPlans((v) => !v)}
              className="font-medium text-gold underline underline-offset-2"
            >
              {showPlans ? "Hide plans" : "Need more uploads?"}
            </button>
          </div>

          {status && (
            <div
              role="status"
              className="mt-4 flex items-center gap-3 rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm text-white/85"
            >
              <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gold border-t-transparent motion-safe:animate-spin" />
              {status}
            </div>
          )}
          {notice && (
            <p className="mt-4 rounded-lg border border-leaf/30 bg-leaf-tint px-4 py-3 text-sm text-leaf-dark">
              {notice}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          {showPlans && (
            <section className="mt-6">
              <h2 className="font-serif text-xl font-semibold text-white">
                Get more uploads
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {(Object.keys(PLANS) as PlanId[]).map((id) => {
                  const p = PLANS[id];
                  return (
                    <div
                      key={id}
                      className="flex flex-col rounded-2xl bg-white p-5 text-ink shadow-xl"
                    >
                      <p className="text-sm font-medium text-muted">{p.name}</p>
                      <p className="mt-1 font-serif text-3xl font-bold">
                        GH₵{cedis(p.pesewas)}
                      </p>
                      <p className="mt-2 flex-1 text-sm leading-6 text-muted">
                        {p.uploads} uploads over {p.days} days. It ends when
                        either one runs out.
                      </p>
                      <button
                        onClick={() => buyPass(id)}
                        disabled={payBusy !== ""}
                        className="mt-4 rounded-lg bg-leaf px-4 py-2.5 text-sm font-semibold text-white hover:bg-leaf-dark disabled:opacity-60"
                      >
                        {payBusy === id
                          ? "Opening payment..."
                          : "Pay with Mobile Money or card"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div>
          {sections.length > 0 ? (
            <section className="rounded-2xl bg-white p-5 text-ink shadow-2xl sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-serif text-2xl font-bold">Your notes</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyNotes}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-line/40"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={downloadNotes}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-line/40"
                  >
                    Download
                  </button>
                  <button
                    onClick={clearNotes}
                    className="px-1 text-sm text-muted underline underline-offset-2"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {sections.map((s, idx) => (
                  <details
                    key={s.title + idx}
                    open={idx < 2}
                    className="group overflow-hidden rounded-xl border border-l-4 border-line border-l-leaf bg-white"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-serif text-lg font-semibold [&::-webkit-details-marker]:hidden">
                      {TITLES[s.title] ?? toTitle(s.title)}
                      <svg
                        className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-90"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="border-t border-line px-4 pb-5 pt-2 text-[15px] leading-7 text-ink/90">
                      {s.lines.map((line, i) => renderLine(line, s.title, i))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : (
            <div className="enter enter-2">
              <p className="mb-3 text-sm font-medium text-white/70">
                What you get from every upload
              </p>
              <div className="rounded-2xl bg-white p-5 text-ink shadow-2xl sm:p-6 lg:-rotate-1">
                <span className="inline-block rounded-full bg-gold-tint px-2.5 py-0.5 text-xs font-medium">
                  Sample from an economics lecture
                </span>

                <h3 className="mt-4 font-serif text-xl font-semibold">Overview</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-ink/90">
                  Every choice has a cost. This lecture shows how economists
                  measure that cost and why it matters when resources are
                  limited.
                </p>

                <h3 className="mt-5 font-serif text-xl font-semibold">Key terms</h3>
                <p className="mt-1.5 text-[15px] leading-7 text-ink/90">
                  <span className="font-semibold">Opportunity cost:</span> the
                  value of the next best option you give up when you make a
                  choice.
                </p>

                <h3 className="mt-5 font-serif text-xl font-semibold">
                  Practice questions
                </h3>
                <p className="mt-1.5 text-[15px] leading-7 text-ink/90">
                  1. A student spends Saturday studying instead of working a
                  paid shift. What is the opportunity cost?
                </p>
                <p className="mt-1.5 rounded-r-md border-l-2 border-leaf bg-leaf-tint px-3 py-1.5 text-[15px] text-leaf-dark">
                  <span className="font-semibold">Answer:</span> The wages they
                  could have earned from the shift.
                </p>
              </div>
              <p className="mt-3 text-sm text-white/60">
                Your own notes appear here after you upload a PDF.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}