"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList, Layers, Wallet } from "lucide-react";
import { CreditTransactionLedger } from "@/components/credits/transaction-ledger";
import { CreditHistorySkeleton } from "@/components/ui/skeleton";
import { prefetchCreditsData, useCreditsData } from "@/lib/credits-data";

export default function CreditHistoryPage() {
  const { data, loading } = useCreditsData();

  if (loading && !data) return <CreditHistorySkeleton />;
  if (!data) return <CreditHistorySkeleton />;

  const evalCost = data.costs?.evaluation ?? 10;
  const flashCost = data.costs?.flashcard_generation ?? 5;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-7 pb-10 sm:space-y-9">
      <header className="space-y-4">
        <Link
          href="/credits"
          onMouseEnter={prefetchCreditsData}
          onFocus={prefetchCreditsData}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <ArrowLeft size={14} />
          Back to credits
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Credit history</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--text-muted)]">
              A statement of credits added, spent, or adjusted — filter by type and browse by day.
            </p>
          </div>
          <p className="font-mono text-xs tabular-nums text-[var(--text-muted)]">
            {data.transactions.length} recorded
          </p>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,var(--accent-soft)_0%,var(--bg-elevated)_52%,var(--flash-soft)_100%)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div
          className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full bg-[var(--flash)] opacity-[0.08] blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--accent)]">
                <Wallet size={15} strokeWidth={1.75} />
              </span>
              Available balance
            </div>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
                {data.balance}
              </span>
              <span className="text-sm text-[var(--text-muted)]">credits</span>
            </p>
          </div>
          <p className="max-w-[13rem] text-xs leading-relaxed text-[var(--text-muted)] sm:text-right">
            New accounts start with 75 free credits for evaluations and decks.
          </p>
        </div>

        <div className="relative mt-5 grid gap-2 border-t border-[var(--line)]/70 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--line)]/70 bg-[var(--bg-elevated)]/80 px-3.5 py-2.5 backdrop-blur-sm">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-[var(--accent)]">
              <ClipboardList size={15} strokeWidth={1.75} />
            </span>
            <p className="text-sm leading-snug">
              ≈{data.estimated_evaluations} evaluation
              {data.estimated_evaluations === 1 ? "" : "s"} left
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                {evalCost} credits each
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-[var(--line)]/70 bg-[var(--bg-elevated)]/80 px-3.5 py-2.5 backdrop-blur-sm">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--flash-soft)] text-[var(--flash)]">
              <Layers size={15} strokeWidth={1.75} />
            </span>
            <p className="text-sm leading-snug">
              ≈{data.estimated_flashcard_generations} flashcard deck
              {data.estimated_flashcard_generations === 1 ? "" : "s"} you can generate
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                {flashCost} credits per generation
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow)] sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-3 border-b border-[var(--line)] pb-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Activity statement</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Grouped by day · filter spent or added
            </p>
          </div>
          <Link
            href="/credits"
            onMouseEnter={prefetchCreditsData}
            onFocus={prefetchCreditsData}
            className="hidden text-xs font-medium text-[var(--accent)] transition hover:text-[var(--accent-hover)] sm:inline"
          >
            Buy a pack →
          </Link>
        </div>

        <CreditTransactionLedger transactions={data.transactions} />
      </section>
    </div>
  );
}
