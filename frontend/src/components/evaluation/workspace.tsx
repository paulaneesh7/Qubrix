"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Clock3,
  GripVertical,
  History,
  Lock,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { RailSkeleton } from "@/components/ui/skeleton";
import { MobileDrawer } from "@/components/ui/mobile-drawer";
import { cn } from "@/lib/utils";

export const CHAT_MIN = 260;
export const CHAT_MAX = 420;
export const CHAT_DEFAULT = 292;
export const FOLLOW_UP_LIMIT = 5;
const WIDTH_KEY = "qubrix.eval.chatWidth";
const PINS_KEY = "qubrix.eval.pins";
const HISTORY_KEY = "qubrix.eval.historyOpen";
const HINTS = ["Why is this wrong?", "Better approach", "GATE trap", "Complexity"];

export type EvalHistoryItem = {
  id: string;
  score: number | null;
  verdict: string | null;
  status: string;
  created_at?: string | null;
  subject?: string | null;
  preview?: string | null;
};

export type ChatLine = { role: string; content: string };

export function EvalWorkspace({
  history,
  historyLoading,
  activeId,
  onNew,
  onDelete,
  children,
  chatEnabled,
  chat,
  onSend,
  sending,
  followUpsUsed = 0,
  followUpLimit = FOLLOW_UP_LIMIT,
  primaryAction,
}: {
  history: EvalHistoryItem[];
  historyLoading: boolean;
  activeId?: string | null;
  onNew: () => void;
  onDelete?: (id: string) => void | Promise<void>;
  children: React.ReactNode;
  chatEnabled: boolean;
  chat: ChatLine[];
  onSend: (message: string) => void;
  sending?: boolean;
  followUpsUsed?: number;
  followUpLimit?: number;
  primaryAction?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [width, setWidth] = useState(CHAT_DEFAULT);
  const [draft, setDraft] = useState("");
  const [pins, setPins] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<EvalHistoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const dragging = useRef(false);
  const widthRef = useRef(CHAT_DEFAULT);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    if (stored >= CHAT_MIN && stored <= CHAT_MAX) {
      setWidth(stored);
      widthRef.current = stored;
    }
    try {
      const raw = JSON.parse(localStorage.getItem(PINS_KEY) || "[]");
      if (Array.isArray(raw)) setPins(raw.filter((id) => typeof id === "string"));
    } catch {
      /* ignore */
    }
    if (localStorage.getItem(HISTORY_KEY) === "0") setHistoryExpanded(false);
  }, []);

  useEffect(() => {
    document.querySelectorAll("[data-follow-log]").forEach((node) => {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    });
  }, [chat, sending]);

  const clamp = useCallback((value: number) => Math.min(CHAT_MAX, Math.max(CHAT_MIN, value)), []);

  const move = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current || !frame.current) return;
      const right = frame.current.getBoundingClientRect().right;
      const next = clamp(right - event.clientX);
      widthRef.current = next;
      setWidth(next);
    },
    [clamp],
  );

  const stop = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.classList.remove("select-none");
    localStorage.setItem(WIDTH_KEY, String(widthRef.current));
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  }, [move]);

  function startDrag(event: React.PointerEvent) {
    event.preventDefault();
    dragging.current = true;
    document.body.classList.add("select-none");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  function togglePin(id: string) {
    setPins((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
      localStorage.setItem(PINS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = history.filter((item) => {
      if (!q) return true;
      return (
        (item.verdict || "").toLowerCase().includes(q) ||
        (item.preview || "").toLowerCase().includes(q) ||
        (item.subject || "").toLowerCase().includes(q)
      );
    });
    return [...matches].sort((a, b) => Number(pins.includes(b.id)) - Number(pins.includes(a.id)));
  }, [history, pins, query]);

  const remaining = Math.max(0, followUpLimit - followUpsUsed);
  const last = chat.at(-1);
  const thinking = Boolean(sending && last?.role === "user");
  const chatLocked = !chatEnabled || remaining <= 0;
  const composerDisabled = chatLocked || Boolean(sending);
  const canSend = Boolean(draft.trim()) && !composerDisabled;
  const progressPct = Math.min(100, (followUpsUsed / Math.max(1, followUpLimit)) * 100);

  function submitChat() {
    const text = draft.trim();
    if (!text || !chatEnabled || sending || remaining <= 0) return;
    onSend(text);
    setDraft("");
  }

  const closeHistory = useCallback(() => setHistoryOpen(false), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  useEffect(() => {
    setHistoryOpen(false);
  }, [activeId]);

  async function confirmDelete() {
    if (!pendingDelete || !onDelete) return;
    setDeleting(true);
    try {
      await Promise.resolve(onDelete(pendingDelete.id));
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  function toggleHistoryRail() {
    setHistoryExpanded((open) => {
      const next = !open;
      localStorage.setItem(HISTORY_KEY, next ? "1" : "0");
      return next;
    });
  }

  const historyPanel = (sheet = false) => (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent-soft)_40%,transparent),transparent_28%)]">
      <div className="flex items-center justify-between border-b border-[var(--line)]/70 px-4 pt-4 pb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Attempts</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{filtered.length} in view</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setHistoryOpen(false);
            onNew();
          }}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs font-medium shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
        >
          <Plus size={12} /> New
        </button>
      </div>
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search attempts"
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] py-2 pl-7 pr-2 text-xs outline-none transition focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--ring)]"
          />
        </div>
      </div>
      <div className="qubrix-sidebar-scroll mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 ? (
          historyLoading ? (
            <RailSkeleton />
          ) : (
            <p className="px-2 py-8 text-xs leading-relaxed text-[var(--text-muted)]">No evaluations yet.</p>
          )
        ) : (
          filtered.map((item) => {
            const pinned = pins.includes(item.id);
            return (
              <div
                key={item.id}
                className={cn(
                  "group relative mb-1.5 rounded-xl pr-1 transition",
                  activeId === item.id
                    ? "bg-[var(--accent-soft)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                    : "hover:bg-[var(--bg-muted)]",
                )}
              >
                {activeId === item.id ? (
                  <span className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full bg-[var(--accent)]" />
                ) : null}
                <Link href={`/evaluation/${item.id}`} className="block px-3 py-2.5 pr-14" onClick={() => setHistoryOpen(false)}>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {pinned ? <Pin size={11} className="mr-1 inline -translate-y-px text-[var(--accent)]" /> : null}
                    {item.preview?.trim() || item.verdict || "Untitled attempt"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {item.score != null ? `${item.score}/10` : item.status}
                    {item.created_at ? ` · ${formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}` : ""}
                  </p>
                </Link>
                <div className="absolute right-1.5 top-2 flex gap-0.5 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={pinned ? "Unpin attempt" : "Pin attempt"}
                    onClick={() => togglePin(item.id)}
                    className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--accent)]"
                  >
                    {pinned ? <PinOff size={13} /> : <Pin size={13} />}
                  </button>
                  {onDelete ? (
                    <button
                      type="button"
                      aria-label="Delete attempt"
                      onClick={() => setPendingDelete(item)}
                      className="grid h-7 w-7 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
      {!sheet ? (
        <button
          type="button"
          onClick={toggleHistoryRail}
          className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] px-3 py-3 text-xs text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
        >
          <PanelLeftClose size={14} /> Collapse
        </button>
      ) : null}
    </div>
  );

  const chatLog = (
    <div data-follow-log className="qubrix-chat-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4">
      {chat.length === 0 && !thinking ? (
        <div className="grid h-full place-items-center px-3 text-center">
          <div className="max-w-[220px]">
            <div
              className={cn(
                "mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border shadow-sm",
                chatEnabled
                  ? "border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line)] bg-[var(--bg-muted)] text-[var(--text-muted)]",
              )}
            >
              {chatEnabled ? <MessageCircle size={22} /> : <Lock size={18} />}
            </div>
            <p className="text-sm font-semibold tracking-tight">
              {chatEnabled ? "Ask Qubrix about this mark" : "Follow-ups locked"}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
              {chatEnabled
                ? remaining > 0
                  ? "Traps, a tighter write-up, or why a step lost marks."
                  : "You've used all free follow-ups for this attempt."
                : "Submit an evaluation to unlock coaching on your score."}
            </p>
            {!chatEnabled ? (
              <div className="mt-4 space-y-1.5 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-elevated)]/80 px-3 py-2.5 text-left">
                {["Why marks were lost", "Stronger framing", "Common GATE traps"].map((item) => (
                  <p key={item} className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <Sparkles size={10} className="shrink-0 text-[var(--accent)]" />
                    {item}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {chat.map((line, i) => (
            <div
              key={`${line.role}-${i}`}
              className={cn("flex gap-2", line.role === "user" ? "justify-end" : "justify-start")}
            >
              {line.role !== "user" ? (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent)]">
                  Q
                </span>
              ) : null}
              <div
                className={cn(
                  "max-w-[88%] text-sm leading-relaxed",
                  line.role === "user"
                    ? "rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2 text-white shadow-[0_8px_20px_var(--ring)]"
                    : "rounded-2xl rounded-bl-md border border-[var(--line)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-[var(--text)] shadow-sm",
                )}
              >
                {line.role === "user" ? (
                  <p className="whitespace-pre-wrap">{line.content}</p>
                ) : (
                  <>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Qubrix
                    </p>
                    <p className="whitespace-pre-wrap">{line.content}</p>
                  </>
                )}
              </div>
            </div>
          ))}
          {thinking ? (
            <div className="flex gap-2">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[10px] font-semibold text-[var(--accent)]">
                Q
              </span>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 shadow-sm">
                <span className="qubrix-typing" aria-hidden>
                  <i />
                  <i />
                  <i />
                </span>
                <span className="text-xs text-[var(--text-muted)]">Thinking…</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  const chatComposer = (
    <div className="border-t border-[var(--line)] bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--accent-soft)_35%,transparent)_40%)] px-3 pb-3 pt-2.5">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {HINTS.map((hint) => (
          <button
            key={hint}
            type="button"
            disabled={composerDisabled}
            onClick={() => onSend(hint)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
              composerDisabled
                ? "cursor-not-allowed border-[var(--line)] bg-[var(--bg-muted)] text-[var(--text-muted)] opacity-55"
                : "border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)]",
            )}
          >
            {hint}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitChat();
        }}
      >
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border px-2 py-1.5 transition",
            chatLocked
              ? "cursor-not-allowed border-dashed border-[var(--line)] bg-[var(--bg-muted)] opacity-70"
              : "border-[var(--line)] bg-[var(--bg-elevated)] shadow-[0_10px_28px_color-mix(in_srgb,var(--text)_6%,transparent)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_var(--ring)]",
          )}
        >
          {chatLocked ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-muted)]">
              <Lock size={13} />
            </span>
          ) : null}
          <textarea
            rows={1}
            value={draft}
            disabled={composerDisabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitChat();
              }
            }}
            placeholder={
              !chatEnabled
                ? "Unlock after evaluation…"
                : remaining <= 0
                  ? "Follow-up limit reached"
                  : "Ask a follow-up…"
            }
            className={cn(
              "max-h-28 min-h-8 flex-1 resize-none bg-transparent px-1.5 py-1.5 text-sm leading-5 outline-none placeholder:text-[var(--text-muted)]",
              composerDisabled && "cursor-not-allowed",
            )}
          />
          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white transition",
              canSend
                ? "cursor-pointer bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
                : "cursor-not-allowed bg-[var(--accent)]/35",
            )}
            aria-label="Send follow-up"
          >
            <Send size={13} />
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          {chatLocked ? (
            <>
              <Lock size={10} />
              {!chatEnabled ? "Evaluate an answer to enable chat" : "No follow-ups remaining on this attempt"}
            </>
          ) : (
            <>
              <Sparkles size={10} className="text-[var(--accent)]" />
              Enter to send · Shift+Enter for a new line
            </>
          )}
        </p>
      </form>
    </div>
  );

  return (
    <div ref={frame} className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[var(--bg)] lg:h-screen lg:min-h-0 lg:flex-row">
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-sidebar)] transition-[width] duration-200 lg:flex",
          historyExpanded ? "w-[248px]" : "w-12",
        )}
      >
        {historyExpanded ? (
          historyPanel()
        ) : (
          <div className="flex h-full flex-col items-center gap-3 py-4">
            <button
              type="button"
              onClick={toggleHistoryRail}
              className="grid h-9 w-9 place-items-center rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--text-muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              aria-label="Expand attempt history"
            >
              <PanelLeftOpen size={16} />
            </button>
            <button
              type="button"
              onClick={onNew}
              className="grid h-9 w-9 place-items-center rounded-md text-[var(--text-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
              aria-label="New attempt"
            >
              <Plus size={16} />
            </button>
            <History size={16} className="mt-1 text-[var(--text-muted)]" />
          </div>
        )}
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>

      <aside
        className="relative hidden shrink-0 flex-col border-l border-[var(--line)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent-soft)_55%,var(--bg))_0%,var(--bg)_160px)] shadow-[-12px_0_32px_color-mix(in_srgb,var(--text)_4%,transparent)] lg:flex"
        style={{ width }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize follow-up chat"
          onPointerDown={startDrag}
          className="absolute inset-y-0 -left-1 z-20 w-3 cursor-col-resize"
        />
        <button
          type="button"
          aria-label="Drag to resize follow-up chat"
          onPointerDown={startDrag}
          className="qubrix-resize-grip absolute top-1/2 -left-2.5 z-30 flex -translate-y-1/2 cursor-col-resize items-center justify-center text-[var(--text-muted)]"
        >
          <GripVertical size={14} />
        </button>

        <div className="shrink-0 border-b border-[var(--line)] px-4 py-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold tracking-tight">Follow-up</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                {followUpsUsed} / {followUpLimit} used
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                chatLocked
                  ? "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                  : "bg-[var(--accent-soft)] text-[var(--accent)]",
              )}
            >
              {chatLocked ? (!chatEnabled ? "Locked" : "Done") : `${remaining} left`}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                remaining <= 0 ? "bg-[var(--text-muted)]" : "bg-[var(--accent)]",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {chatLog}
        {chatComposer}
      </aside>

      <div className="sticky bottom-0 z-20 flex gap-2 border-t border-[var(--line)] bg-[var(--bg)]/95 px-3 py-2.5 backdrop-blur lg:hidden pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-elevated)] text-sm font-medium"
        >
          <Clock3 size={16} /> History
        </button>
        {chatEnabled ? (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[var(--accent)] text-sm font-medium text-white"
          >
            <MessageCircle size={16} /> Follow-up
          </button>
        ) : primaryAction ? (
          <div className="min-w-0 flex-[1.35]">{primaryAction}</div>
        ) : null}
      </div>

      <MobileDrawer open={historyOpen} onClose={closeHistory} title="History" side="left">
        {historyPanel(true)}
      </MobileDrawer>
      <MobileDrawer open={chatOpen} onClose={closeChat} title="Follow-up" side="bottom" className="bg-[var(--bg)]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
            <span className="text-[11px] text-[var(--text-muted)]">
              {followUpsUsed} / {followUpLimit} used
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                chatLocked
                  ? "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                  : "bg-[var(--accent-soft)] text-[var(--accent)]",
              )}
            >
              {chatLocked ? (!chatEnabled ? "Locked" : "Done") : `${remaining} left`}
            </span>
          </div>
          {chatLog}
          {chatComposer}
        </div>
      </MobileDrawer>

      {pendingDelete ? (
        <div className="fixed bottom-[4.75rem] right-4 z-[80] w-[min(360px,calc(100vw-2rem))] rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] p-4 shadow-[0_18px_50px_rgba(20,16,32,0.18)] lg:bottom-5 lg:right-5">
          <p className="text-sm font-medium">Delete this attempt?</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">
            {pendingDelete.preview?.trim() || pendingDelete.verdict || "Untitled attempt"}
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-muted)]">This removes it from history. It cannot be undone.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
            >
              Keep
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

