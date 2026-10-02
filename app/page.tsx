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

type Section = { title: string; lines: string[] };
type Pass = {
  id: string;
  plan: string;
  uploads_total: number;
  uploads_used: number;
  expires_at: string;
};

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

  if (isHeading(t)) {
    return (
      <h3 key={i} className="mt-5 text-base font-bold text-gray-900">
        {t}
      </h3>
    );
  }

  if (/^part [abc]/i.test(t)) {
    return (
      <h3 key={i} className="mt-5 text-base font-bold text-blue-700">
        {t}
      </h3>
    );
  }

  const answer = t.match(/^answer\s*:\s*(.*)$/i);
  if (answer) {
    return (
      <p key={i} className="mt-1 rounded bg-green-50 px-2 py-1 text-green-900">
        <span className="font-semibold">Answer:</span> {answer[1]}
      </p>
    );
  }

  if (title === "KEY TERMS") {
    const term = t.match(/^([^:]{2,60}):\s*(.+)$/);
    if (term) {
      return (
        <p key={i} className="mt-2">
          <span className="font-semibold text-gray-900">{term[1]}:</span> {term[2]}
        </p>
      );
    }
  }

  return (
    <p key={i} className="mt-1">
      {t}
    </p>
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

        setNotice("Payment received. Your pass is active!");
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

      setStatus("Creating your study notes and questions...");
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
        <p className="text-gray-600">Loading...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold">Study Assistant</h1>
        <p className="mt-3 text-gray-600">
          Log in to turn your lecture slides into study notes and practice questions.
        </p>

        <form onSubmit={handleAuth} className="mt-8 w-full space-y-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (at least 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900"
          />
          <button
            type="submit"
            disabled={authBusy}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {authBusy ? "Please wait..." : mode === "signup" ? "Create account" : "Log in"}
          </button>
        </form>

        {authMsg && <p className="mt-4 text-sm text-red-600">{authMsg}</p>}

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setAuthMsg("");
          }}
          className="mt-6 text-sm text-gray-600 underline"
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Log in"}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center p-6 pt-10 text-center">
      <div className="flex w-full items-center justify-between text-sm text-gray-500">
        <span className="truncate">{session.user.email}</span>
        <button onClick={logOut} className="underline">
          Log out
        </button>
      </div>

      <h1 className="mt-8 text-3xl font-bold">Study Assistant</h1>
      <p className="mt-3 text-gray-600">
        Upload your lecture slides and get a summary and practice questions.
      </p>

      <label className="mt-8 cursor-pointer rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
        Choose a PDF
        <input type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
      </label>

      {passes.length > 0 && lastExpiry ? (
        <p className="mt-4 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-900">
          Pass active: {uploadsLeft} uploads left, valid until{" "}
          {lastExpiry.toLocaleDateString()}
        </p>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Free plan: 2 uploads per day.</p>
      )}

      {status && <p className="mt-4 text-gray-600">{status}</p>}
      {notice && <p className="mt-4 text-green-700">{notice}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      {!showPlans && (
        <button
          onClick={() => setShowPlans(true)}
          className="mt-4 text-sm text-blue-700 underline"
        >
          Need more uploads? See plans
        </button>
      )}

      {showPlans && (
        <div className="mt-6 w-full">
          <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {(Object.keys(PLANS) as PlanId[]).map((id) => {
              const p = PLANS[id];
              return (
                <div key={id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    GH₵{cedis(p.pesewas)}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {p.uploads} uploads, valid for {p.days} days (whichever ends first)
                  </p>
                  <button
                    onClick={() => buyPass(id)}
                    disabled={payBusy !== ""}
                    className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {payBusy === id ? "Opening payment..." : "Buy with Mobile Money or card"}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setShowPlans(false)}
            className="mt-3 text-sm text-gray-500 underline"
          >
            Hide plans
          </button>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={copyNotes}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            {copied ? "Copied!" : "Copy notes"}
          </button>
          <button
            onClick={downloadNotes}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Download
          </button>
          <button onClick={clearNotes} className="text-sm text-gray-500 underline">
            Clear notes
          </button>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mt-6 w-full space-y-3 text-left">
          {sections.map((s, idx) => (
            <details
              key={s.title + idx}
              open={idx < 2}
              className="rounded-lg border border-gray-200 bg-white"
            >
              <summary className="cursor-pointer select-none rounded-lg bg-gray-50 px-4 py-3 font-semibold text-gray-900">
                {s.title}
              </summary>
              <div className="px-4 pb-4 pt-2 text-sm leading-relaxed text-gray-800">
                {s.lines.map((line, i) => renderLine(line, s.title, i))}
              </div>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}