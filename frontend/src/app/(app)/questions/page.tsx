"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CardListSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type Q = {
  id: string;
  stem: string;
  question_type: string;
  difficulty: string;
  source_reference: string;
  is_ai_generated: boolean;
};

export default function QuestionBankPage() {
  const [items, setItems] = useState<Q[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ total: number; items: Q[] }>("/api/questions")
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <p>{error}</p>;
  if (loading) return <CardListSkeleton />;

  return (
    <div>
      <h1 className="font-serif text-4xl">Question Bank</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{total} items. Demo questions are labelled; they are not official PYQs.</p>
      <div className="mt-6 space-y-3">
        {items.length === 0 && <Card>No questions match these filters yet.</Card>}
        {items.map((q) => (
          <Link key={q.id} href={`/questions/${q.id}`}>
            <Card className="hover:border-[var(--ink)]">
              <div className="flex gap-2">
                <Badge>{q.question_type}</Badge>
                <Badge tone="brass">{q.difficulty}</Badge>
                {q.is_ai_generated && <Badge tone="warn">AI-generated</Badge>}
              </div>
              <p className="mt-2 text-sm">{q.stem}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">{q.source_reference}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
