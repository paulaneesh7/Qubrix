"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type Mock = { id: string; title: string; duration_minutes: number; description: string; kind: string };
type Start = {
  attempt_id: string;
  duration_minutes: number;
  questions: { id: string; stem: string; question_type: string; section: string; options: { id: string; label: string; text: string }[] }[];
};

export default function MockTestsPage() {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [session, setSession] = useState<Start | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    api<Mock[]>("/api/mock-tests")
      .then(setMocks)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function start(id: string) {
    setStarting(id);
    const data = await api<Start>(`/api/mock-tests/${id}/start`, { method: "POST" });
    setSession(data);
    setIdx(0);
    setScore(null);
    setStarting(null);
  }

  async function submit() {
    if (!session) return;
    const payload: Record<string, { selected_option_ids: string[] }> = {};
    Object.entries(answers).forEach(([k, v]) => {
      payload[k] = { selected_option_ids: v };
    });
    const res = await api<{ score: number }>(`/api/mock-tests/attempts/${session.attempt_id}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers: payload }),
    });
    setScore(res.score);
  }

  if (score !== null) {
    return (
      <Card>
        <h1 className="font-serif text-3xl">Mock submitted</h1>
        <p className="mt-3">Score {score} (ScoringEngine, exam-configurable).</p>
        <Button className="mt-4" onClick={() => setSession(null)}>Back</Button>
      </Card>
    );
  }

  if (session) {
    const q = session.questions[idx];
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div>
          <p className="text-sm text-[var(--muted)]">{q.section} · {q.question_type} · {idx + 1}/{session.questions.length}</p>
          <h1 className="mt-2 font-serif text-2xl">{q.stem}</h1>
          <div className="mt-4 space-y-2">
            {q.options.map((o) => (
              <button
                key={o.id}
                className="block w-full rounded-md border border-[var(--line)] px-3 py-2 text-left text-sm"
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: [o.id] }))}
              >
                {o.label}. {o.text}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setIdx((i) => Math.max(0, i - 1))}>Prev</Button>
            <Button variant="secondary" onClick={() => setIdx((i) => Math.min(session.questions.length - 1, i + 1))}>Next</Button>
            <Button onClick={() => void submit()}>Submit test</Button>
          </div>
        </div>
        <Card>
          <p className="text-sm font-medium">Palette</p>
          <div className="mt-3 grid grid-cols-5 gap-1">
            {session.questions.map((item, i) => (
              <button key={item.id} className="rounded border border-[var(--line)] text-xs py-1" onClick={() => setIdx(i)}>
                {i + 1}
              </button>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-4xl">Mock Tests</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Full, subject, topic, and custom tests share one scoring engine.</p>
      <div className="mt-6 grid gap-3">
        {loading ? (
          <CardListSkeleton header={false} />
        ) : (
          mocks.map((m) => (
            <Card key={m.id}>
              <h2 className="font-serif text-2xl">{m.title}</h2>
              <p className="text-sm text-[var(--muted)]">{m.description} · {m.duration_minutes} min · {m.kind}</p>
              <Button
                className="mt-3"
                disabled={starting === m.id}
                onClick={() => void start(m.id).catch((e) => { toast.error(e.message); setStarting(null); })}
              >
                {starting === m.id ? (
                  <>
                    <Loader size="sm" /> Starting…
                  </>
                ) : (
                  "Start mock test"
                )}
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
