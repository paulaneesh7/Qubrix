"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatGridSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function AdminPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api("/api/admin/overview")
      .then((d) => setData(d as Record<string, unknown>))
      .catch((e) => setError(e.message));
  }, []);
  if (error) return <p>{error}</p>;
  if (!data) return <StatGridSkeleton count={6} withList={false} />;
  return (
    <div>
      <h1 className="font-serif text-4xl">Admin</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {["users", "questions_attempted", "evaluations", "flashcard_generations", "credits_consumed", "revenue_placeholder"].map((k) => (
          <Card key={k}>
            <p className="text-xs uppercase text-[var(--muted)]">{k.replaceAll("_", " ")}</p>
            <p className="mt-2 font-serif text-3xl">{String(data[k])}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
