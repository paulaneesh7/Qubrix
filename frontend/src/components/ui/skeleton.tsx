import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("qubrix-skeleton", className)} />;
}

function Frame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      {children}
    </div>
  );
}

export function CreditsPageSkeleton() {
  return (
    <Frame
      label="Loading credits"
      className="mx-auto w-full min-w-0 max-w-5xl space-y-8 pb-10 sm:space-y-10"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-9 w-32 sm:h-10" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-10 w-36 shrink-0 rounded-md" />
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 sm:p-7">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-12 w-28 sm:h-14" />
        <div className="mt-6 grid gap-3 border-t border-[var(--line)]/70 pt-5 sm:grid-cols-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      </div>

      <div>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
        <div className="mt-5 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-4 w-24" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-6 h-8 w-20" />
              <Skeleton className="mt-8 h-10 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 sm:p-6">
        <Skeleton className="h-5 w-44" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function CreditHistorySkeleton() {
  return (
    <Frame
      label="Loading credit history"
      className="mx-auto w-full min-w-0 max-w-5xl space-y-7 pb-10 sm:space-y-9"
    >
      <div className="space-y-4">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <Skeleton className="h-9 w-48 sm:h-10" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 sm:p-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-4 h-12 w-24" />
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-14 w-full max-w-xs" />
          <Skeleton className="h-8 w-40 rounded-md" />
        </div>
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </Frame>
  );
}

export function ChartSkeleton() {
  return (
    <Frame label="Loading score trend" className="mt-8 space-y-3">
      <Skeleton className="h-44 w-full rounded-md" />
      <Skeleton className="h-3 w-40" />
    </Frame>
  );
}

export function RailSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Frame label="Loading list" className="space-y-1 px-1 py-2">
      {Array.from({ length: rows }, (_, item) => (
        <div key={item} className="space-y-2 px-2 py-2.5">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </Frame>
  );
}

export function EvalResultSkeleton() {
  return (
    <Frame
      label="Loading evaluation"
      className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 md:px-10 md:py-8"
    >
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-full max-w-lg" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </Frame>
  );
}

export function DeckSkeleton() {
  return (
    <Frame
      label="Loading deck"
      className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-4 px-1 py-2 sm:px-2"
    >
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-40 sm:w-56" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <Skeleton className="h-3 w-32" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-40 rounded-2xl" />
        ))}
      </div>
    </Frame>
  );
}

export function CardListSkeleton({ header = true }: { header?: boolean }) {
  const cards = [0, 1, 2, 3].map((item) => (
    <div
      key={item}
      className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-5 sm:p-6"
    >
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-4 h-9 w-32 rounded-md" />
    </div>
  ));

  if (!header) {
    return (
      <Frame label="Loading" className="contents">
        {cards}
      </Frame>
    );
  }

  return (
    <Frame label="Loading" className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3">{cards}</div>
    </Frame>
  );
}

export function StatGridSkeleton({ count = 3, withList = true }: { count?: number; withList?: boolean }) {
  return (
    <Frame label="Loading" className="space-y-6">
      <Skeleton className="h-10 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, item) => (
          <div
            key={item}
            className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-6"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-9 w-16" />
          </div>
        ))}
      </div>
      {withList ? (
        <div className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-6">
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : null}
    </Frame>
  );
}

export function QuestionDetailSkeleton() {
  return (
    <Frame
      label="Loading question"
      className="rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow)]"
    >
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="mt-4 h-8 w-full" />
      <Skeleton className="mt-2 h-8 w-3/4" />
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-10 w-full" />
        ))}
      </div>
    </Frame>
  );
}
