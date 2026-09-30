"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { ChartSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { api, cacheCredits, peekCredits } from "@/lib/api";

const SUBJECTS = [
  "All subjects",
  "Engineering Mathematics",
  "Programming & DS",
  "Algorithms",
  "Theory of Computation",
  "Compiler Design",
  "Operating Systems",
  "Databases",
  "Computer Networks",
  "Computer Organization",
  "Digital Logic",
  "General Aptitude",
];

type EvalRow = {
  id: string;
  score: number | null;
  verdict: string | null;
  status: string;
  created_at?: string;
  subject?: string | null;
};

type Deck = { id: string; card_count: number };

function ScoreChart({ points }: { points: { id: string; score: number }[] }) {
  const w = 640;
  const h = 180;
  const pad = 16;
  const max = 10;
  const xs = points.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(points.length - 1, 1));
  const ys = points.map((p) => h - pad - (p.score / max) * (h - pad * 2));
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${ys[i]}`).join(" ");
  const area = `${line} L ${xs[xs.length - 1]} ${h - pad} L ${xs[0]} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" role="img" aria-label="Score trend chart">
      {[0, 2.5, 5, 7.5, 10].map((tick) => {
        const y = h - pad - (tick / max) * (h - pad * 2);
        return (
          <g key={tick}>
            <line x1={pad} x2={w - pad} y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
            <text x={4} y={y + 3} className="fill-[var(--text-muted)]" fontSize="10">
              {tick}
            </text>
          </g>
        );
      })}
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={points[i].id} cx={x} cy={ys[i]} r="3.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(
    () => (typeof user?.credits === "number" ? user.credits : peekCredits()),
  );
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [subject, setSubject] = useState("All subjects");

  useEffect(() => {
    if (typeof user?.credits === "number") {
      setCredits(user.credits);
      cacheCredits(user.credits);
    }
  }, [user?.credits]);

  useEffect(() => {
    api<{ balance: number }>("/api/credits/balance")
      .then((d) => {
        setCredits(d.balance);
        cacheCredits(d.balance);
      })
      .catch(() => setCredits((current) => current ?? peekCredits() ?? 0));
    api<EvalRow[]>("/api/evaluations")
      .then(setEvals)
      .catch(() => setEvals([]))
      .finally(() => setChartLoading(false));
    api<Deck[]>("/api/flashcards/decks")
      .then(setDecks)
      .catch(() => setDecks([]));
  }, []);

  const scored = useMemo(() => {
    const rows = evals.filter((row) => row.score != null);
    const filtered =
      subject === "All subjects"
        ? rows
        : rows.filter((row) => (row.subject || "").toLowerCase().includes(subject.toLowerCase()));
    return filtered
      .slice()
      .reverse()
      .slice(-10)
      .map((row) => ({ id: row.id, score: Number(row.score) }));
  }, [evals, subject]);

  const avg =
    scored.length > 0 ? (scored.reduce((sum, row) => sum + row.score, 0) / scored.length).toFixed(1) : null;
  const cardCount = decks.reduce((sum, deck) => sum + (deck.card_count || 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          GATE CS workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">
          Pick a module to start studying, then check your score trend to see how your answer writing is improving over time.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            [evals.filter((e) => e.score != null).length, "Scored evaluations", chartLoading],
            [avg ?? "—", "Average / 10", chartLoading],
            [credits ?? "—", "Credits left", credits == null],
          ] as const
        ).map(([value, label, pending]) => (
          <div key={label} className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-4 py-3">
            {pending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            )}
            <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,#ffffff,var(--accent-soft))] p-6 dark:bg-[linear-gradient(180deg,var(--bg-elevated),var(--accent-soft))]">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/90 text-[var(--accent)] ring-1 ring-[var(--line)] dark:bg-[var(--bg-elevated)]">
            <ClipboardList size={20} />
          </span>
          <h2 className="mt-5 text-xl font-semibold">Answer Evaluation</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">
            Submit a GATE CS question and your solution — typed or photographed — and get criterion-wise marks, a better approach, and follow-up chat.
          </p>
          <Link
            href="/evaluation"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] py-2.5 text-sm font-medium text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]"
          >
            Open Answer Evaluation <ArrowRight size={16} />
          </Link>
        </article>

        <article className="flex flex-col rounded-2xl border border-[var(--line)] bg-[linear-gradient(180deg,#ffffff,var(--flash-soft))] p-6 dark:bg-[linear-gradient(180deg,var(--bg-elevated),var(--flash-soft))]">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--flash-soft)] text-[var(--flash)] ring-1 ring-[var(--flash-ring)]">
            <Layers size={20} />
          </span>
          <h2 className="mt-5 text-xl font-semibold">Flashcards</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-muted)]">
            Generate AI revision decks for any GATE CS topic. Flip through cards, drill facts, and keep weak subjects in rotation before the paper.
          </p>
          <Link
            href="/flashcards"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] py-2.5 text-sm font-medium transition hover:bg-[var(--bg-muted)]"
          >
            Open Flashcards <ArrowRight size={16} />
          </Link>
        </article>
      </div>

      <section className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-6">
        <h2 className="text-lg font-semibold">Score trend</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Tracks your last 10 answer evaluations on a 10-point scale. Filter by GATE CS subject to see how each paper is going.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Select
            value="GATE CS"
            onChange={() => undefined}
            ariaLabel="Exam"
            variant="field"
            options={[{ value: "GATE CS", label: "GATE CS" }]}
          />
          <Select
            value={subject}
            onChange={setSubject}
            ariaLabel="Subject"
            menuTitle="Subject"
            variant="field"
            className="min-w-[180px]"
            options={SUBJECTS.map((name) => ({ value: name, label: name }))}
          />
        </div>

        {chartLoading ? (
          <ChartSkeleton />
        ) : scored.length === 0 ? (
          <div className="mt-8 py-10 text-center">
            <p className="text-sm text-[var(--text-muted)]">
              {evals.length === 0
                ? "No GATE CS evaluations yet."
                : "No scored attempts in this subject yet."}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
              Once you submit a few answers, this chart will plot your scores out of 10 so you can see progress at a glance.
            </p>
            <Link
              href="/evaluation"
              className="mt-5 inline-flex rounded-md border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm"
            >
              Start your first evaluation
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <ScoreChart points={scored} />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Latest {scored.length} scored {scored.length === 1 ? "attempt" : "attempts"} · average {avg}/10
            </p>
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-[var(--text-muted)]">
          {evals.filter((e) => e.score != null).length === 0
            ? "No evaluations yet — start with Answer Evaluation to get scored feedback."
            : `${evals.filter((e) => e.score != null).length} scored evaluation${evals.filter((e) => e.score != null).length === 1 ? "" : "s"} so far.`}{" "}
          {decks.length === 0
            ? "No revision decks yet."
            : `You have ${decks.length} deck${decks.length === 1 ? "" : "s"} (${cardCount} card${cardCount === 1 ? "" : "s"}) for revision.`}
          {credits != null ? ` ${credits} credits available.` : ""}
        </p>
      </section>
    </div>
  );
}
