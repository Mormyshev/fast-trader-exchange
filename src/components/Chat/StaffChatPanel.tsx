"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send, Users } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth, startPolling } from "@/src/utils/supabase/realtime";
import { subscribeStaffChatInbox } from "@/src/utils/supabase/staff-chat-inbox";
import { MAX_CHAT_ATTACHMENT_BYTES } from "@/src/utils/chat/types";
import {
  staffDisplayName,
  type StaffChatConversation,
  type StaffChatMessage,
} from "@/src/utils/chat/staff-internal";
import OperatorAvatar from "./OperatorAvatar";
import { useAuth } from "@/src/app/context/AuthContext";
import { Button } from "@/components/ui/button";

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

function senderName(message: StaffChatMessage) {
  return staffDisplayName({
    operator_pseudonym: message.sender?.operator_pseudonym,
    email: message.sender?.email,
  });
}

export default function StaffChatPanel({
  conversation,
  onConversationChange,
}: {
  conversation: StaffChatConversation;
  onConversationChange?: (conversation: StaffChatConversation) => void;
}) {
  const conversationId = conversation.id;
  const { user } = useAuth();
  const [messages, setMessages] = useState<StaffChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onConversationChangeRef = useRef(onConversationChange);
  onConversationChangeRef.current = onConversationChange;

  const isGroup = conversation.kind === "group";
  const title = isGroup
    ? "Общий чат"
    : conversation.peer
      ? staffDisplayName(conversation.peer)
      : "Личные сообщения";
  const subtitle = isGroup
    ? "Операторы и администратор"
    : conversation.peer?.role === "admin"
      ? "Администратор"
      : "Оператор";

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const upsertMessage = useCallback(
    (row: StaffChatMessage | null | undefined) => {
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
        const res = await fetch(`/api/staff/chat/${conversationId}/messages`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");
        const next = (data.messages ?? []) as StaffChatMessage[];
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
      .channel(`staff-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "staff_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          upsertMessage(payload.new as StaffChatMessage);
        },
      );

    void subscribeWithAuth(supabase, pgChannel);

    const inbox = subscribeStaffChatInbox(supabase, {
      onMessage: (payload) => {
        if (payload.conversationId !== conversationId) return;
        upsertMessage(payload.message as StaffChatMessage);
      },
      onConversation: (payload) => {
        const next = payload.conversation as StaffChatConversation | undefined;
        if (next?.id === conversationId) {
          onConversationChangeRef.current?.(next);
        }
      },
    });

    const stopPoll = startPolling(() => void loadMessages(true), 5000);

    return () => {
      stopPoll();
      inbox.unsubscribe();
      void supabase.removeChannel(pgChannel);
    };
  }, [conversationId, loadMessages, upsertMessage]);

  const sendText = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
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
      const res = await fetch(`/api/staff/chat/${conversationId}/attachments`, {
        method: "POST",
        body: form,
      });
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

  return (
    <div className="flex flex-col h-full min-h-0 max-h-full bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
      <div className="px-4 py-3 border-b border-zinc-100 bg-[#FFF8D6] flex items-center gap-3 shrink-0">
        {isGroup ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFDD2D] text-zinc-900">
            <Users className="h-4 w-4" />
          </div>
        ) : (
          <OperatorAvatar
            name={title}
            size="sm"
            profile={conversation.peer}
          />
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900 truncate">{title}</p>
          <p className="text-xs font-medium text-zinc-500 truncate">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 space-y-3 bg-white">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#FFDD2D]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-amber-200/40 bg-[#FFF9E6] px-4 py-6 text-center">
            <p className="text-sm text-zinc-600">
              {isGroup
                ? "Это общий чат команды. Напишите первое сообщение."
                : `Начните переписку с ${title}.`}
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isMine = message.sender_id === user?.id;
            const prev = index > 0 ? messages[index - 1] : null;
            const showDay =
              !prev || !isSameCalendarDay(prev.created_at, message.created_at);
            const showSender =
              isGroup &&
              !isMine &&
              (!prev ||
                prev.sender_id !== message.sender_id ||
                !isSameCalendarDay(prev.created_at, message.created_at));

            return (
              <div key={message.id} className="space-y-3">
                {showDay ? (
                  <div className="flex justify-center">
                    <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">
                      {formatDayLabel(message.created_at)}
                    </span>
                  </div>
                ) : null}
                <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                      isMine
                        ? "bg-[#FFDD2D] text-zinc-900 border border-[#e6c628]/35"
                        : "bg-[#FFF3B0]/55 text-zinc-800 border border-amber-200/70"
                    }`}
                  >
                    {showSender ? (
                      <p className="mb-1 text-[11px] font-bold text-amber-800">
                        {senderName(message)}
                        {message.sender?.role === "admin" ? " · админ" : ""}
                      </p>
                    ) : null}
                    {message.body ? (
                      <p className="whitespace-pre-wrap break-words">
                        {message.body}
                      </p>
                    ) : null}
                    {message.attachment_url ? (
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
                    ) : null}
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

      {error ? (
        <p className="px-4 pb-2 text-xs text-rose-600 font-medium bg-rose-50 border-t border-rose-100">
          {error}
        </p>
      ) : null}

      <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-3 py-3 flex items-end gap-2">
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
          className="rounded-full shrink-0 h-10 w-10 border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 hover:border-zinc-400"
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
          className="flex-1 min-h-[44px] max-h-28 resize-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#FFDD2D] focus:ring-2 focus:ring-[#FFDD2D]/20"
        />
        <Button
          type="button"
          size="icon"
          className="rounded-full h-10 w-10 bg-zinc-900 hover:bg-zinc-800 text-white shrink-0 disabled:bg-zinc-300 disabled:text-zinc-500"
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
    </div>
  );
}
