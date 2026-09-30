"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeckBoard } from "@/components/flashcards/deck-board";
import { useFlashStudio } from "@/components/flashcards/use-flash-decks";
import { DeckSkeleton } from "@/components/ui/skeleton";
import { api, getToken } from "@/lib/api";
import { getFlashDecks, removeFlashDeck, upsertFlashDeck } from "@/lib/flash-store";
import type { FlashDeck } from "@/lib/flashcards";

export default function FlashDeckPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const flash = useFlashStudio();
  const cached = flash.decks.find((d) => d.id === params.id) ?? null;
  const [missingId, setMissingId] = useState<string | null>(null);
  const missing = missingId === params.id && !cached;

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    const owner = getToken();
    const sawCache = getFlashDecks().some((deck) => deck.id === id);
    let cancelled = false;
    api<FlashDeck>(`/api/flashcards/decks/${id}`)
      .then((deck) => {
        if (cancelled || getToken() !== owner) return;
        upsertFlashDeck(deck, owner);
        setMissingId((current) => (current === id ? null : current));
      })
      .catch(() => {
        if (cancelled || getToken() !== owner) return;
        if (!sawCache) setMissingId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function remove() {
    if (!params.id) return;
    const id = params.id;
    removeFlashDeck(id);
    toast.success("Deck removed");
    router.replace("/flashcards");
    const owner = getToken();
    try {
      await api(`/api/flashcards/decks/${id}`, { method: "DELETE" });
    } catch (e) {
      if (getToken() !== owner) return;
      toast.error(e instanceof Error ? e.message : "Could not delete deck");
      void api<FlashDeck[]>("/api/flashcards/decks").then((d) => {
        if (getToken() !== owner) return;
        flash.setDecks(d, owner);
      });
    }
  }

  if (missing) {
    return (
      <div className="grid flex-1 place-items-center px-4">
        <p className="text-sm text-[var(--text-muted)]">This deck was not found. Generate a new one from history.</p>
      </div>
    );
  }

  if (!cached) {
    return <DeckSkeleton />;
  }

  return (
    <DeckBoard
      deck={cached}
      onDeck={upsertFlashDeck}
      onDelete={() => void remove()}
      pinned={flash.pins.includes(cached.id)}
      onPin={() => flash.togglePin(cached.id)}
    />
  );
}
