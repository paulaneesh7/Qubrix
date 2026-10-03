"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, Flame, Layers, MessageCircle, PenLine, Target, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreditTransactionLedger } from "@/components/credits/transaction-ledger";
import { CreditsPageSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { prefetchCreditsData, useCreditsData, type CreditPayment } from "@/lib/credits-data";
import { formatCreditTime } from "@/lib/credits-ui";
import { cn } from "@/lib/utils";

const PLAN_COPY: Record<string, { name: string; blurb: string }> = {
  starter: { name: "Starter", blurb: "A few scored answers to see the rubric." },
  popular: { name: "Focus", blurb: "Enough credits for a steady weekly loop." },
  pro: { name: "Intensive", blurb: "A full revision block before the exam." },
};

const PAYMENT_STATUS: Record<string, string> = {
  pending: "Waiting for payment",
  processing: "Processing",
  succeeded: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

const CHECKOUT_KEY = "qubrix.checkout";
const RETURN_KEYS = ["status", "payment_id", "email", "subscription_id", "license_key", "checkout"];

type PendingCheckout = { paymentId: string; planCode: string };

function readPendingCheckout(): PendingCheckout | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCheckout>;
    if (!parsed.paymentId || !parsed.planCode) return null;
    return { paymentId: parsed.paymentId, planCode: parsed.planCode };
  } catch {
    return null;
  }
}

function rememberCheckout(pending: PendingCheckout) {
  sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(pending));
}

function clearPendingCheckout() {
  sessionStorage.removeItem(CHECKOUT_KEY);
}

function checkoutStatusFromUrl() {
  const url = new URL(window.location.href);
  const status = (url.searchParams.get("status") || "").toLowerCase();
  const echoed = RETURN_KEYS.some((key) => url.searchParams.has(key));
  if (echoed) {
    for (const key of RETURN_KEYS) url.searchParams.delete(key);
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", next);
  }
  return { status, echoed };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function PaymentRow({ payment }: { payment: CreditPayment }) {
  const name = PLAN_COPY[payment.plan_code]?.name ?? payment.plan_code;
  const label = PAYMENT_STATUS[payment.status] ?? payment.status;
  const paid = payment.status === "succeeded";
  const failed = payment.status === "failed" || payment.status === "cancelled";
  return (
    <li className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {name} · ₹{payment.price_inr}
        </p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          {payment.credits.toLocaleString()} credits · {formatCreditTime(payment.created_at)}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
          paid && "bg-[var(--accent-soft)] text-[var(--accent)]",
          failed && "bg-[var(--flash-soft)] text-[var(--flash)]",
          !paid && !failed && "bg-[var(--bg-muted)] text-[var(--text-muted)]",
        )}
      >
        {label}
      </span>
    </li>
  );
}

function packValue(credits: number, evalCost: number, flashCost: number) {
  return {
    evals: evalCost > 0 ? Math.floor(credits / evalCost) : 0,
    decks: flashCost > 0 ? Math.floor(credits / flashCost) : 0,
    cards: flashCost > 0 ? Math.floor(credits / flashCost) * 8 : 0,
  };
}

export default function CreditsPage() {
  const { data, loading, reload } = useCreditsData();
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function watchPayment(paymentId: string) {
      for (const delay of [2000, 4000, 8000]) {
        await sleep(delay);
        if (!active) return;
        try {
          const next = await reload();
          const row = next.payments?.find((payment) => payment.id === paymentId);
          if (row?.status === "succeeded") {
            toast.success(`${row.credits.toLocaleString()} credits added to your account.`, {
              id: "checkout-granted",
            });
            return;
          }
          if (row?.status === "failed") {
            toast.error("Payment failed. You have not been charged.", { id: "checkout-return" });
            return;
          }
          if (row?.status === "cancelled") {
            toast.message("Payment cancelled. You have not been charged.", { id: "checkout-return" });
            return;
          }
        } catch {
          return;
        }
      }
    }

    async function settleCheckoutReturn() {
      const pending = readPendingCheckout();
      const { status, echoed } = checkoutStatusFromUrl();
      if (!pending && !echoed) return;
      // A crafted return URL cannot grant credits or show a payment result.
      if (!pending) return;

      clearPendingCheckout();
      if (active) setBuying(null);

      const succeeded = status === "succeeded" || status === "success" || status === "paid";
      const failed = status === "failed" || status === "failure";
      const cancelled = status === "cancelled" || status === "canceled";
      const processing = status === "processing" || status === "pending";

      if (!status) {
        try {
          await api("/api/credits/checkout/abandon", {
            method: "POST",
            body: JSON.stringify({ payment_id: pending.paymentId }),
          });
        } catch {
          /* The row stays pending if this request fails. Credits are unchanged. */
        }
        if (!active) return;
        toast.message("Checkout closed. No payment was taken.", { id: "checkout-return" });
        void reload().catch(() => undefined);
        return;
      }

      if (cancelled || failed) {
        try {
          await api("/api/credits/checkout/abandon", {
            method: "POST",
            body: JSON.stringify({ payment_id: pending.paymentId }),
          });
        } catch {
          /* A webhook may already have recorded the final status. */
        }
        if (!active) return;
        toast.error(
          failed
            ? "Payment failed. You have not been charged."
            : "Payment cancelled. You have not been charged.",
          { id: "checkout-return" },
        );
        void reload().catch(() => undefined);
        return;
      }

      if (succeeded || processing) {
        toast.message(
          succeeded
            ? "Payment received. Credits are added once the payment is confirmed."
            : "Payment is processing. Credits are added when it completes.",
          { id: "checkout-return" },
        );
        void watchPayment(pending.paymentId);
        return;
      }

      toast.message("We could not confirm this payment. You have not been charged yet.", {
        id: "checkout-return",
      });
      void reload().catch(() => undefined);
    }

    void settleCheckoutReturn();

    function onPageShow() {
      setBuying(null);
      void settleCheckoutReturn();
    }

    window.addEventListener("pageshow", onPageShow);
    return () => {
      active = false;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [reload]);

  async function buy(planCode: string) {
    setBuying(planCode);
    try {
      const result = await api<{ checkout_url: string; payment_id: string }>("/api/credits/checkout", {
        method: "POST",
        body: JSON.stringify({ plan_code: planCode }),
      });
      if (!result.checkout_url.startsWith("https://") || !result.payment_id) {
        throw new Error("Checkout did not return a payment link.");
      }
      rememberCheckout({ paymentId: result.payment_id, planCode });
      window.location.assign(result.checkout_url);
    } catch (error) {
      clearPendingCheckout();
      toast.error(error instanceof Error ? error.message : "Could not open checkout", {
        id: "checkout-open",
      });
      setBuying(null);
    }
  }

  const evalCost = data?.costs?.evaluation ?? 10;
  const flashCost = data?.costs?.flashcard_generation ?? 5;

  const plans = useMemo(() => {
    if (!data) return [];
    return [...data.plans].sort((a, b) => a.price_inr - b.price_inr);
  }, [data]);

  if (loading && !data) return <CreditsPageSkeleton />;
  if (!data) return <CreditsPageSkeleton />;

  const recent = data.transactions.slice(0, 5);
  const hasMore = data.transactions.length > 5;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8 pb-10 sm:space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Credits</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">
            Pay as you go — no subscription. Buy a pack and use credits on evaluations or flashcards.
          </p>
        </div>
        <Link
          href="/credits/history"
          onMouseEnter={prefetchCreditsData}
          onFocus={prefetchCreditsData}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3.5 py-2 text-sm font-medium transition hover:bg-[var(--bg-muted)] sm:self-auto"
        >
          Credit history <ArrowRight size={14} />
        </Link>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[linear-gradient(135deg,var(--accent-soft)_0%,var(--bg-elevated)_48%,var(--flash-soft)_100%)] p-5 shadow-[var(--shadow)] sm:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-[var(--flash)] opacity-[0.08] blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--bg-elevated)] text-[var(--accent)] ring-1 ring-[var(--line)]">
                <Wallet size={16} />
              </span>
              Available balance
            </div>
            <p className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight sm:text-6xl">{data.balance}</span>
              <span className="text-base text-[var(--text-muted)]">credits</span>
            </p>
          </div>
          <p className="max-w-[14rem] text-xs leading-relaxed text-[var(--text-muted)] sm:text-right">
            New accounts get 75 free credits to start evaluating and generating decks.
          </p>
        </div>

        <div className="relative mt-6 grid gap-3 border-t border-[var(--line)]/70 pt-5 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl bg-[var(--bg-elevated)]/70 px-3.5 py-3 ring-1 ring-[var(--line)]/80 backdrop-blur-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <ClipboardList size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium">
                ≈{data.estimated_evaluations} evaluation
                {data.estimated_evaluations === 1 ? "" : "s"} left
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">{evalCost} credits each</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-[var(--bg-elevated)]/70 px-3.5 py-3 ring-1 ring-[var(--line)]/80 backdrop-blur-sm">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--flash-soft)] text-[var(--flash)]">
              <Layers size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-medium">
                ≈{data.estimated_flashcard_generations} flashcard deck
                {data.estimated_flashcard_generations === 1 ? "" : "s"} you can generate
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {flashCost} credits per generation
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 sm:mb-5">
          <h2 className="text-lg font-semibold tracking-tight">Buy a pack</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Checkout opens in Dodo. Credits are added after the payment is confirmed.
          </p>
        </div>

        <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const key = `${plan.code} ${plan.name} ${plan.badge ?? ""}`.toLowerCase();
            const tone = /popular|most|focus/.test(key) ? "accent" : /pro|intensive|best/.test(key) ? "warm" : "muted";
            const accent = tone === "accent";
            const warm = tone === "warm";
            const Icon = accent ? Target : warm ? Flame : PenLine;
            const value = packValue(plan.credits, evalCost, flashCost);
            const copy = PLAN_COPY[plan.code];
            const blurb = copy?.blurb ?? "Prepaid credits";
            const title = copy?.name ?? plan.name;
            const badge = plan.badge === "Popular" ? "Most used" : plan.badge || (accent ? "Most used" : warm ? "Best value" : "First papers");

            return (
              <article
                key={plan.code || plan.name}
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow)] sm:p-6",
                  accent && "border-[var(--accent)]/50 bg-[var(--accent-soft)] shadow-[0_16px_40px_var(--ring)]",
                  warm && "border-[var(--flash)]/35 bg-[var(--flash-soft)]",
                  !accent && !warm && "border-[var(--line)] bg-[var(--bg-elevated)]",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      accent && "bg-[var(--accent)] text-[var(--accent-text)]",
                      warm && "bg-[var(--flash)] text-[#1a140c]",
                      !accent && !warm && "bg-[var(--bg-muted)] text-[var(--accent)]",
                    )}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium",
                      accent && "bg-[var(--bg-elevated)] text-[var(--accent)]",
                      warm && "bg-[var(--bg-elevated)] text-[var(--flash)]",
                      !accent && !warm && "bg-[var(--bg-muted)] text-[var(--text-muted)]",
                    )}
                  >
                    {badge}
                  </span>
                </div>

                <h3 className="mt-4 text-sm font-medium">{title}</h3>
                <p className="mt-1 min-h-10 text-sm leading-snug text-[var(--text-muted)]">{blurb}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">₹{plan.price_inr}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{plan.credits.toLocaleString()} credits</p>

                <div className="mt-5 space-y-2 border-t border-[var(--line)]/80 pt-4 text-sm">
                  <p className="flex items-center gap-2">
                    <PenLine size={14} className="shrink-0 text-[var(--text-muted)]" />
                    <span>≈ {value.evals} GATE evaluations</span>
                  </p>
                  <p className="flex items-start gap-2 text-[var(--text-muted)]">
                    <Layers size={14} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      or ≈ {value.decks} flashcard decks
                      {value.cards > 0 ? ` (~${value.cards.toLocaleString()})` : ""}
                    </span>
                  </p>
                </div>

                <div className="mt-auto h-6" aria-hidden />
                <button
                  type="button"
                  disabled={buying !== null}
                  aria-busy={buying === plan.code}
                  onClick={() => void buy(plan.code)}
                  className={cn(
                    "w-full rounded-md py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-80",
                    accent && "bg-[var(--accent)] text-[var(--accent-text)]",
                    warm && "bg-[var(--flash)] text-[#1a140c]",
                    !accent && !warm && "border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--text)]",
                  )}
                >
                  {buying === plan.code ? "Opening checkout…" : `Buy ${title}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {(data.payments?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow)] sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Your payments</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Each checkout is saved on your account. Credits are added only when a payment is paid.
          </p>
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {data.payments?.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow)] sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">How credits are spent</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Pay only when you use an AI feature. Reviewing flashcards and failed evaluations on our side
          are free.
        </p>

        <ul className="mt-5 divide-y divide-[var(--line)]">
          <li className="flex items-center justify-between gap-4 py-3.5 first:pt-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <ClipboardList size={17} />
              </span>
              <span className="text-sm font-medium">GATE Evaluation</span>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[var(--accent)]">
              {evalCost} credits
            </span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--flash-soft)] text-[var(--flash)]">
                <Layers size={17} />
              </span>
              <span className="text-sm font-medium">Flashcard Generation</span>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[var(--accent)]">
              {flashCost} credits
            </span>
          </li>
          <li className="flex items-center justify-between gap-4 py-3.5 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-muted)]">
                <MessageCircle size={17} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Evaluation Follow-up Chat</span>
                  <span className="rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                    Free
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Includes follow-up messages on each scored evaluation.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[var(--accent)]">₹0</span>
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-2 border-t border-[var(--line)] pt-5 sm:flex-row sm:gap-3">
          <Link
            href="/evaluation"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-text)] transition hover:bg-[var(--accent-hover)]"
          >
            Evaluate an answer <ArrowRight size={14} />
          </Link>
          <Link
            href="/flashcards"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg)] px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--bg-muted)]"
          >
            Create flashcards <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow)] sm:p-6">
        <div className="mb-5 flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Recent activity</h2>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              Latest movements on your wallet
            </p>
          </div>
          <Link
            href="/credits/history"
            onMouseEnter={prefetchCreditsData}
            onFocus={prefetchCreditsData}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] transition hover:text-[var(--accent-hover)]"
          >
            View full history <ArrowRight size={14} />
          </Link>
        </div>

        <CreditTransactionLedger
          transactions={recent}
          showFilters={false}
          showSummary={false}
          compact
          emptyHint="No movements yet. Your first evaluation or flashcard generation will show up here."
        />

        {hasMore && (
          <div className="mt-4 border-t border-[var(--line)] pt-4 text-center">
            <Link
              href="/credits/history"
              onMouseEnter={prefetchCreditsData}
              onFocus={prefetchCreditsData}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--bg)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--bg-muted)]"
            >
              See all {data.transactions.length} transactions <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
