"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EvalWorkspace, FOLLOW_UP_LIMIT, type ChatLine, type EvalHistoryItem } from "@/components/evaluation/workspace";
import { EvalResultSkeleton } from "@/components/ui/skeleton";
import { api, streamSse } from "@/lib/api";
import { cn } from "@/lib/utils";

type EvalOut = {
  id: string;
  score: number;
  max_score: number;
  verdict: string;
  question_text?: string;
  confidence?: number | null;
  result: {
    correctness: number;
    approach: number;
    reasoning: number;
    efficiency: number;
    strengths: string[];
    mistakes: string[];
    missing_concepts?: string[];
    corrected_solution: string;
    better_approach: string;
    key_takeaways: string[];
    common_trap: string;
    final_answer: string;
    uncertainty_notes: string;
    subject?: string;
    paper?: string;
    mark_weight?: string;
  };
  messages?: ChatLine[];
};

type Tab = "feedback" | "correction" | "takeaways";

function band(score: number) {
  if (score >= 8.5) return "Distinction band";
  if (score >= 7) return "High credit";
  if (score >= 5.5) return "Credit";
  return "Needs another pass";
}

const AXES: { key: keyof EvalOut["result"]; label: string; hint: string }[] = [
  { key: "correctness", label: "Correctness", hint: "Facts and final claim" },
  { key: "approach", label: "Approach", hint: "Method on the sheet" },
  { key: "reasoning", label: "Reasoning", hint: "Why, not only what" },
  { key: "efficiency", label: "Efficiency", hint: "Tightness under time" },
];

export default function EvaluationResultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<EvalOut | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<EvalHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("feedback");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<EvalHistoryItem[]>("/api/evaluations")
      .then(setHistory)
      .catch(() => undefined)
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    api<EvalOut>(`/api/evaluations/${params.id}`)
      .then((d) => {
        setData(d);
        setChat(d.messages || []);
      })
      .catch((e) => toast.error(e.message));
  }, [params.id]);

  async function remove(id: string) {
    await api(`/api/evaluations/${id}`, { method: "DELETE" });
    setHistory((rows) => rows.filter((row) => row.id !== id));
    if (id === params.id) router.push("/evaluation");
  }

  async function ask(message: string) {
    if (asking) return;
    setAsking(true);
    setChat((c) => [...c, { role: "user", content: message }]);
    let received = false;
    try {
      for await (const event of streamSse(`/api/evaluations/${params.id}/chat/stream`, { message })) {
        if (event.error) throw new Error(String(event.error));
        if (typeof event.delta !== "string") continue;
        const delta = event.delta;
        received = true;
        setChat((c) => {
          const last = c.at(-1);
          if (last?.role === "assistant") {
            return [...c.slice(0, -1), { role: "assistant", content: last.content + delta }];
          }
          return [...c, { role: "assistant", content: delta }];
        });
      }
      if (!received) {
        setChat((c) => [...c, { role: "assistant", content: "I could not generate a follow-up. Please try again." }]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Follow-up failed");
    } finally {
      setAsking(false);
    }
  }

  if (!data) {
    return (
      <EvalWorkspace
        history={history}
        historyLoading={historyLoading}
        activeId={params.id}
        onNew={() => router.push("/evaluation")}
        onDelete={(id) => remove(id)}
        chatEnabled={false}
        chat={[]}
        onSend={() => undefined}
      >
        <EvalResultSkeleton />
      </EvalWorkspace>
    );
  }

  const r = data.result || {};
  const used = chat.filter((m) => m.role === "user").length;
  const confidence = Math.round(((data.confidence ?? 0) * 100) || 0);
  const meta = [r.paper, r.subject, r.mark_weight ? `${r.mark_weight}-mark flavour` : null, "Formative · not official"].filter(
    Boolean,
  );

  return (
    <EvalWorkspace
      history={history}
      historyLoading={historyLoading}
      activeId={data.id}
      onNew={() => router.push("/evaluation")}
      onDelete={(id) => remove(id)}
      chatEnabled
      chat={chat}
      onSend={(m) => void ask(m)}
      sending={asking}
      followUpsUsed={used}
      followUpLimit={FOLLOW_UP_LIMIT}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 md:px-10 md:py-8">
          <button
            type="button"
            onClick={() => router.push("/evaluation")}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <ArrowLeft size={14} /> New evaluation
          </button>

          <header className="mt-6 border-b border-[var(--line)] pb-8">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]">{meta.join("  ·  ")}</p>
            <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">{band(data.score)}</p>
                <h1 className="mt-2 text-[1.65rem] font-semibold leading-snug tracking-tight md:text-[1.85rem]">
                  {data.verdict}
                </h1>
                {data.question_text ? (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{data.question_text}</p>
                ) : null}
              </div>
              <div className="lg:text-right">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Score</p>
                <p className="mt-1 font-semibold leading-none tracking-tight">
                  <span className="text-6xl">{data.score}</span>
                  <span className="ml-1 text-lg text-[var(--text-muted)]">/ {data.max_score}</span>
                </p>
                <p className="mt-3 text-[11px] text-[var(--text-muted)]">Model confidence {confidence}%</p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--line)] bg-[var(--line)] sm:grid-cols-4">
              {AXES.map((axis) => {
                const n = Number(r[axis.key] ?? 0);
                return (
                  <div key={axis.key} className="bg-[var(--bg-elevated)] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">{axis.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {n}
                      <span className="text-sm font-normal text-[var(--text-muted)]">/5</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{axis.hint}</p>
                  </div>
                );
              })}
            </div>
          </header>

          <nav className="mt-2 flex gap-6 border-b border-[var(--line)]">
            {(
              [
                ["feedback", "Examiner notes"],
                ["correction", "Model write-up"],
                ["takeaways", "Exam strategy"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "-mb-px border-b-2 py-3 text-sm transition",
                  tab === id
                    ? "border-[var(--text)] font-medium"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]",
                )}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "feedback" && (
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <section>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">01 · Credit</p>
                <h2 className="mt-1 text-lg font-semibold">What held</h2>
                <ol className="mt-4 space-y-4">
                  {(r.strengths || []).map((s, i) => (
                    <li key={s} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-5 shrink-0 pt-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">02 · Deduction</p>
                <h2 className="mt-1 text-lg font-semibold">Where marks slipped</h2>
                <ol className="mt-4 space-y-4">
                  {(r.mistakes || []).map((s, i) => (
                    <li key={s} className="flex gap-3 text-sm leading-relaxed">
                      <span className="w-5 shrink-0 pt-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          )}

          {tab === "correction" && (
            <section className="mt-8">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    03 · Answer sheet
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">Rewrite under time</h2>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                  onClick={async () => {
                    await navigator.clipboard.writeText(r.corrected_solution || "");
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1400);
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="mt-5 border-l-2 border-[var(--accent)] pl-5">
                <p className="whitespace-pre-wrap text-sm leading-7">{r.corrected_solution}</p>
              </div>
              <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Closing line</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{r.final_answer}</p>
            </section>
          )}

          {tab === "takeaways" && (
            <div className="mt-8 grid gap-10 lg:grid-cols-2">
              <section>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">04 · Method</p>
                <h2 className="mt-1 text-lg font-semibold">Better GATE approach</h2>
                <p className="mt-4 text-sm leading-7">{r.better_approach}</p>
                <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">Classic trap</p>
                <p className="mt-2 text-sm leading-relaxed">{r.common_trap}</p>
              </section>
              <section>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">05 · Keep</p>
                <h2 className="mt-1 text-lg font-semibold">Carry into the hall</h2>
                <ul className="mt-4 space-y-3">
                  {(r.key_takeaways || []).map((s, i) => (
                    <li key={s} className="border-t border-[var(--line)] pt-3 text-sm leading-relaxed first:border-t-0 first:pt-0">
                      <span className="mr-2 text-[11px] tabular-nums text-[var(--text-muted)]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
                {(r.missing_concepts || []).length > 0 && (
                  <p className="mt-6 text-sm text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--text)]">Still thin: </span>
                    {(r.missing_concepts || []).join(" · ")}
                  </p>
                )}
              </section>
            </div>
          )}

          {r.uncertainty_notes ? (
            <p className="mt-12 border-t border-[var(--line)] pt-4 text-xs leading-relaxed text-[var(--text-muted)]">
              {r.uncertainty_notes}
            </p>
          ) : null}
        </div>
      </div>
    </EvalWorkspace>
  );
}
