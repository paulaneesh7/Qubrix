"use client";

import { useCallback, useEffect, useState } from "react";
import { api, cacheCredits } from "@/lib/api";
import type { CreditTx } from "@/lib/credits-ui";

export type CreditPlan = {
  code: string;
  name: string;
  price_inr: number;
  credits: number;
  badge: string | null;
  placeholder?: boolean;
};

export type CreditPayment = {
  id: string;
  plan_code: string;
  price_inr: number;
  credits: number;
  status: "pending" | "processing" | "succeeded" | "failed" | "cancelled" | string;
  failure_message: string | null;
  created_at: string;
};

export type CreditsData = {
  balance: number;
  estimated_evaluations: number;
  estimated_flashcard_generations: number;
  costs?: Record<string, number>;
  transactions: CreditTx[];
  plans: CreditPlan[];
  payments?: CreditPayment[];
};

const TTL_MS = 45_000;

let cache: CreditsData | null = null;
let cachedAt = 0;
let inflight: Promise<CreditsData> | null = null;

export function peekCreditsData() {
  return cache;
}

export function invalidateCreditsData() {
  cache = null;
  cachedAt = 0;
}

function isFresh() {
  return cache != null && Date.now() - cachedAt < TTL_MS;
}

export function loadCreditsData(options?: { force?: boolean }): Promise<CreditsData> {
  if (!options?.force && isFresh() && cache) {
    return Promise.resolve(cache);
  }
  if (inflight) return inflight;

  inflight = api<CreditsData>("/api/credits")
    .then((data) => {
      cache = data;
      cachedAt = Date.now();
      cacheCredits(data.balance);
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Prefetch without blocking — useful on link hover. */
export function prefetchCreditsData() {
  void loadCreditsData().catch(() => undefined);
}

/**
 * Shared credits payload for /credits and /credits/history.
 * Warm cache → render immediately (no full-page loader), refresh in background.
 */
export function useCreditsData() {
  const [data, setData] = useState<CreditsData | null>(() => cache);
  const [loading, setLoading] = useState(() => cache == null);

  useEffect(() => {
    let cancelled = false;
    const hadCache = cache != null;

    if (!hadCache) setLoading(true);

    loadCreditsData({ force: hadCache })
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (!hadCache) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(() => {
    return loadCreditsData({ force: true })
      .then((next) => {
        setData(next);
        setLoading(false);
        return next;
      })
      .catch((error: unknown) => {
        setLoading(false);
        throw error;
      });
  }, []);

  return { data, loading, reload };
}
