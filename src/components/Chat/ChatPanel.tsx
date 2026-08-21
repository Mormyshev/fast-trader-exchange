"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth, startPolling } from "@/src/utils/supabase/realtime";
import { subscribeSupportInbox } from "@/src/utils/supabase/support-inbox";
import type { ChatConversation, ChatMessage } from "@/src/utils/chat/types";
import { MAX_CHAT_ATTACHMENT_BYTES } from "@/src/utils/chat/types";
import OperatorAvatar from "./OperatorAvatar";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/src/hooks/useConfirmDialog";

type ChatPanelProps = {
  conversationId: string;
  mode: "user" | "operator";
  conversation?: ChatConversation | null;
  onConversationChange?: (conversation: ChatConversation) => void;
  showClaimButton?: boolean;
  onClaim?: () => Promise<void>;
  canReply?: boolean;
  currentOperatorId?: string | null;
};

function getOperatorDisplayName(conversation?: ChatConversation | null) {
  const pseudonym = conversation?.operator?.operator_pseudonym?.trim();
  return pseudonym || null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function isSameCalendarDay(a: string, b: string) {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

function formatDayLabel(iso: string) {
  const date = new Date(iso);
  const today = startOfDay(new Date());
  const that = startOfDay(date);
  const diffDays = Math.round((today - that) / 86_400_000);
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatPanel({
  conversationId,
  mode,
  conversation,
  onConversationChange,
  showClaimButton,
  onClaim,
  canReply = true,
  currentOperatorId = null,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmDialogHost } = useConfirmDialog();

  const operatorName = getOperatorDisplayName(conversation);
  const isAssignedToMe =
    mode === "operator" &&
    !!conversation?.operator_id &&
    !!currentOperatorId &&
    conversation.operator_id === currentOperatorId;
  const isAssignedToOther =
    mode === "operator" &&
    !!conversation?.operator_id &&
    !!currentOperatorId &&
    conversation.operator_id !== currentOperatorId;
  const assignedStaffName =
    conversation?.assigned_operator?.operator_pseudonym?.trim() || null;
  const canSend =
    mode === "user" ||
    (canReply && (!conversation?.operator_id || isAssignedToMe));
  const canTakeDialog =
    !!showClaimButton &&
    canReply &&
    !!onClaim &&
    (!conversation?.operator_id || isAssignedToOther);
  const takeDialogLabel = conversation?.operator_id
    ? "Взять диалог на себя"
    : "Взять в работу";

  const onConversationChangeRef = useRef(onConversationChange);
  onConversationChangeRef.current = onConversationChange;

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const upsertMessage = useCallback(
    (row: ChatMessage | null | undefined) => {
      if (!row?.id || row.conversation_id !== conversationId) return;
      setMessages((prev) => {
        if (prev.some((message) => message.id === row.id)) return prev;
        return [...prev, row];
      });
    },
    [conversationId],
  );

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/chat/conversations/${conversationId}/messages`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
        const next = (data.messages ?? []) as ChatMessage[];
        setMessages((prev) => {
          if (
            silent &&
            prev.length === next.length &&
            prev.every((message, index) => message.id === next[index]?.id)
          ) {
            return prev;
          }
          return next;
        });
        if (data.conversation) {
          onConversationChangeRef.current?.(data.conversation);
        }
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const supabase = createClient();

    const pgChannel = supabase
      .channel(`chat-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          upsertMessage(payload.new as ChatMessage);
        },
      );

    void subscribeWithAuth(supabase, pgChannel);

    const inbox =
      mode === "operator"
        ? subscribeSupportInbox(supabase, {
            onMessage: (payload) => {
              if (payload.conversationId !== conversationId) return;
              upsertMessage(payload.message as ChatMessage);
            },
            onConversation: (payload) => {
              const next = payload.conversation as ChatConversation | undefined;
              if (next?.id === conversationId) {
                onConversationChangeRef.current?.(next);
              }
            },
          })
        : null;

    const stopPoll = startPolling(() => void loadMessages(true), 5000);

    return () => {
      stopPoll();
      inbox?.unsubscribe();
      void supabase.removeChannel(pgChannel);
    };
  }, [conversationId, loadMessages, mode, upsertMessage]);

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/chat/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось отправить");
      setText("");
      upsertMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  const sendFile = async (file: File) => {
    if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
      setError("Файл слишком большой (макс. 10 МБ)");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (text.trim()) form.append("body", text.trim());

      const res = await fetch(
        `/api/chat/conversations/${conversationId}/attachments`,
        { method: "POST", body: form },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить файл");
      setText("");
      upsertMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleClaim = async () => {
    if (!onClaim || claiming) return;

    const ok = await confirm(
      conversation?.operator_id
        ? {
            title: "Взять диалог на себя?",
            description: assignedStaffName
              ? `Диалог сейчас в работе у ${assignedStaffName}. Вы уверены, что хотите перехватить его?`
              : "Диалог сейчас в работе у другого оператора. Вы уверены, что хотите перехватить его?",
            confirmLabel: "Взять на себя",
          }
        : {
            title: "Взять диалог в работу?",
            description:
              "Клиент увидит вас как оператора поддержки в этом чате.",
            confirmLabel: "Взять в работу",
          },
    );
    if (!ok) return;

    setClaiming(true);
    setError(null);
    try {
      await onClaim();
      await loadMessages(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось взять чат");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="px-4 py-3 border-b border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-r from-[#FFF3B0] to-[#FFFEEB] dark:from-amber-950/40 dark:to-amber-950/20 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {mode === "user" ? (
            operatorName ? (
              <>
                <OperatorAvatar name={operatorName} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {operatorName}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    Оператор поддержки
                  </p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Поддержка Aurum Swap
                </p>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  Ожидайте оператора
                </p>
              </div>
            )
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {conversation?.user?.email ?? "Клиент"}
              </p>
              <p className="text-xs text-zinc-500 truncate">
                {!conversation?.operator_id
                  ? "Не назначен"
                  : isAssignedToMe
                    ? "Ваш диалог"
                    : assignedStaffName
                      ? `В работе у: ${assignedStaffName}`
                      : "В работе у другого оператора"}
              </p>
            </div>
          )}
        </div>

        {canTakeDialog && (
          <Button
            size="sm"
            onClick={() => void handleClaim()}
            disabled={claiming}
            className="rounded-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 font-bold shrink-0"
          >
            {claiming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              takeDialogLabel
            )}
          </Button>
        )}
      </div>

      {!canReply && mode === "operator" && (
        <div className="px-4 py-3 bg-amber-100/80 border-b border-amber-200/70 text-sm text-amber-950 shrink-0">
          Заполните{" "}
          <Link
            href="/operator/profile"
            className="font-bold underline underline-offset-2"
          >
            профиль оператора
          </Link>
          , чтобы отвечать в чате.
        </div>
      )}

      {isAssignedToOther && (
        <div className="px-4 py-3 bg-zinc-100 border-b border-zinc-200 text-sm text-zinc-700 shrink-0">
          {assignedStaffName
            ? `Диалог в работе у ${assignedStaffName}.`
            : "Диалог в работе у другого оператора."}{" "}
          Нажмите «Взять диалог на себя», чтобы ответить.
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 space-y-3 bg-white dark:bg-zinc-950">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#FFDD2D]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-amber-200/40 bg-[#FFF9E6] dark:bg-amber-950/20 px-4 py-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Напишите сообщение — оператор ответит в ближайшее время.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMine =
              mode === "user"
                ? message.sender_id === conversation?.user_id
                : message.sender_id !== conversation?.user_id;
            const prev = index > 0 ? messages[index - 1] : null;
            const showDay =
              !prev || !isSameCalendarDay(prev.created_at, message.created_at);

            return (
              <div key={message.id} className="space-y-3">
                {showDay && (
                  <div className="flex justify-center">
                    <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                      {formatDayLabel(message.created_at)}
                    </span>
                  </div>
                )}
              <div
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    isMine
                      ? "bg-[#FFDD2D] text-zinc-900 border border-[#e6c628]/35"
                      : "bg-[#FFF3B0]/55 dark:bg-amber-950/30 text-zinc-800 dark:text-zinc-200 border border-amber-200/70 dark:border-amber-900/40"
                  }`}
                >
                  {message.body && (
                    <p className="whitespace-pre-wrap break-words">
                      {message.body}
                    </p>
                  )}
                  {message.attachment_url && (
                    <div className="mt-2">
                      {message.attachment_type?.startsWith("video/") ? (
                        <video
                          controls
                          className="max-w-full rounded-lg max-h-48"
                          src={message.attachment_url}
                        />
                      ) : message.attachment_type?.startsWith("image/") ? (
                        <a
                          href={message.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.attachment_url}
                            alt={message.attachment_name ?? "attachment"}
                            className="max-w-full rounded-lg max-h-48 object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={message.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-semibold break-all"
                        >
                          {message.attachment_name ?? "Файл"}
                        </a>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] opacity-60 mt-1 text-right">
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="px-4 pb-2 text-xs text-rose-600 font-medium bg-rose-50 border-t border-rose-100">
          {error}
        </p>
      )}

      <div
        className={`shrink-0 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80 px-3 py-3 flex items-end gap-2 ${
          !canSend ? "opacity-60 pointer-events-none" : ""
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,application/pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void sendFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-full shrink-0 h-10 w-10 border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 hover:border-zinc-400 dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
          disabled={uploading || sending}
          onClick={() => fileRef.current?.click()}
          aria-label="Прикрепить файл"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Paperclip className="w-4 h-4" />
          )}
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
          rows={1}
          placeholder="Сообщение..."
          className="flex-1 min-h-[44px] max-h-28 resize-none rounded-2xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#FFDD2D] focus:ring-2 focus:ring-[#FFDD2D]/20"
        />
        <Button
          type="button"
          size="icon"
          className="rounded-full h-10 w-10 bg-zinc-900 hover:bg-zinc-800 text-white shrink-0 disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-700"
          disabled={sending || uploading || !text.trim()}
          onClick={() => void sendText()}
          aria-label="Отправить"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      <ConfirmDialogHost />
    </div>
  );
}
