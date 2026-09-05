"use client";

import { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Loader2 } from "lucide-react";
import ChatPanel from "@/src/components/Chat/ChatPanel";
import type { ChatConversation } from "@/src/utils/chat/types";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";

export default function UserSupportPage() {
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/chat/conversations", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.conversation) {
        throw new Error(data.error || "Не удалось открыть чат");
      }
      setConversation(data.conversation);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть чат");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!conversation?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`user-support-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_conversations",
          filter: `id=eq.${conversation.id}`,
        },
        () => {
          void loadConversation(true);
        },
      );
    void subscribeWithAuth(supabase, channel);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation?.id, loadConversation]);

  return (
    <div className="flex h-[calc(100dvh-5.25rem)] min-h-[28rem] flex-col gap-4 sm:h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6rem)] -mb-10 sm:-mb-12 md:-mb-16 pb-4">
      <div className="shrink-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#2A2A2A]">
          Служба поддержки
        </h1>
        <p className="text-sm font-medium text-zinc-400 mt-1">
          Один чат с поддержкой по всем заявкам и вопросам
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
            <Loader2 className="w-8 h-8 animate-spin text-[#FFDD2D]" />
          </div>
        ) : error || !conversation ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl bg-white px-6 text-center shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
            <div className="flex size-12 items-center justify-center rounded-xl bg-[#FFF4C2] text-[#C9A227]">
              <LifeBuoy className="size-6" />
            </div>
            <p className="text-sm font-medium text-zinc-500">
              {error || "Не удалось открыть чат"}
            </p>
            <button
              type="button"
              onClick={() => void loadConversation()}
              className="h-11 rounded-full bg-[#FFDD2D] px-5 text-sm font-bold text-zinc-900 hover:bg-[#e6c628]"
            >
              Повторить
            </button>
          </div>
        ) : (
          <ChatPanel
            conversationId={conversation.id}
            mode="user"
            conversation={conversation}
            onConversationChange={setConversation}
          />
        )}
      </div>
    </div>
  );
}
