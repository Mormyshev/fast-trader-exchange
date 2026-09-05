"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeWithAuth } from "@/src/utils/supabase/realtime";
import { useAuth } from "@/src/app/context/AuthContext";
import type { ChatConversation } from "@/src/utils/chat/types";
import ChatPanel from "./ChatPanel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export default function ChatWidget() {
  const { role } = useAuth();
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const conversationRef = useRef<ChatConversation | null>(null);
  conversationRef.current = conversation;

  const loadConversation = useCallback(async () => {
    const isFirstLoad = !conversationRef.current;
    if (isFirstLoad) setLoading(true);
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (res.ok && data.conversation) {
        setConversation(data.conversation);
      }
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && role === "user") {
      void loadConversation();
    }
  }, [open, role, loadConversation]);

  useEffect(() => {
    if (!open || !conversation?.id || role !== "user") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`chat-conversation-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_conversations",
          filter: `id=eq.${conversation.id}`,
        },
        () => {
          void loadConversation();
        },
      );

    void subscribeWithAuth(supabase, channel);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, conversation?.id, role, loadConversation]);

  if (role !== "user" || pathname.startsWith("/user/support")) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-14 h-14 bg-[#FFDD2D] hover:bg-[#e6c628] rounded-full flex items-center justify-center text-zinc-900 shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 relative group"
        aria-label="Открыть чат поддержки"
      >
        <span className="absolute inset-0 rounded-full bg-[#FFDD2D]/40 animate-ping pointer-events-none group-hover:opacity-0 transition-opacity" />
        <MessageCircle className="w-6 h-6 fill-zinc-900 stroke-none relative z-10" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-md p-0 flex flex-col gap-0 border-l border-zinc-200 bg-white h-full max-h-dvh overflow-hidden"
        >
          <SheetHeader className="px-4 py-3 border-b border-amber-200/60 bg-gradient-to-r from-[#FFDD2D] to-[#FFF3B0] flex-row items-center justify-between space-y-0 shrink-0">
            <SheetTitle className="text-base font-bold text-zinc-900">
              {conversation?.operator_id
                ? conversation.assigned_operator?.chat_pseudonym?.trim() ||
                  (conversation.assigned_operator?.role === "admin"
                    ? "Администратор на связи"
                    : "Техподдержка на связи")
                : "Чат с поддержкой"}
            </SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 hover:bg-black/5 shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 text-zinc-900" />
            </button>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-hidden p-3 bg-white">
            {loading || !conversation ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-500 rounded-2xl border border-zinc-200 bg-zinc-50">
                {loading ? "Загрузка..." : "Не удалось открыть чат"}
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
        </SheetContent>
      </Sheet>
    </>
  );
}
