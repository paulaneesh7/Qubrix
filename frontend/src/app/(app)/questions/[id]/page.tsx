"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionDetailSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type Q = {
  id: string;
  stem: string;
  question_type: string;
  source_reference: string;
  options: { id: string; label: string; text: string }[];
};

export default function QuestionPage() {
  const params = useParams<{ id: string }>();
  const [q, setQ] = useState<Q | null>(null);

  useEffect(() => {
    api<Q>(`/api/questions/${params.id}`).then(setQ).catch((e) => toast.error(e.message));
  }, [params.id]);

  if (!q) return <QuestionDetailSkeleton />;

  return (
    <Card>
      <Badge>{q.question_type}</Badge>
      <h1 className="mt-3 font-serif text-3xl">{q.stem}</h1>
      <p className="mt-2 text-xs text-[var(--muted)]">{q.source_reference}</p>
      <ul className="mt-6 space-y-2 text-sm">
        {q.options.map((o) => (
          <li key={o.id}>{o.label}. {o.text}</li>
        ))}
      </ul>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => api(`/api/questions/${q.id}/bookmark`, { method: "POST" }).then(() => toast.success("Bookmarked"))}>Bookmark</Button>
        <Button variant="secondary" onClick={() => api(`/api/questions/${q.id}/report?reason=unclear`, { method: "POST" }).then(() => toast.success("Reported"))}>Report question</Button>
      </div>
      <p className="mt-4 text-sm text-[var(--muted)]">Ask AI from the Tutor or Evaluation screens with this stem pasted in.</p>
    </Card>
  );
}
