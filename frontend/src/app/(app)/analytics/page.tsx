"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatGridSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function AnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api("/api/analytics").then((d) => setData(d as Record<string, unknown>));
  }, []);
  if (!data) return <StatGridSkeleton />;
  const subjects = (data.subject_accuracy as { topic_id: string; accuracy: number; attempted: number; trend: string }[]) || [];
  return (
    <div>
      <h1 className="font-serif text-4xl">Analytics</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card>Accuracy <p className="font-serif text-3xl">{String(data.accuracy)}%</p></Card>
        <Card>Questions <p className="font-serif text-3xl">{String(data.questions_solved)}</p></Card>
        <Card>Evaluations <p className="font-serif text-3xl">{String(data.evaluations)}</p></Card>
      </div>
      <Card className="mt-6">
        <h2 className="font-medium">Topic heatmap</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {subjects.length === 0 && <li className="text-[var(--muted)]">Attempt questions to populate this view.</li>}
          {subjects.map((s) => (
            <li key={s.topic_id} className="flex justify-between">
              <span>{s.topic_id?.slice(0, 8) || "subject"}</span>
              <span>{Math.round(s.accuracy * 100)}% · {s.attempted} · {s.trend}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
