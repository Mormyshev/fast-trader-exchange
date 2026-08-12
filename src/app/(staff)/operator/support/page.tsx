"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeSupportInbox } from "@/src/utils/supabase/support-inbox";
import type { ChatConversation } from "@/src/utils/chat/types";
import ChatPanel from "@/src/components/Chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/src/app/context/AuthContext";

function getUserLabel(conversation: ChatConversation) {
  const user = conversation.user;
  if (user?.first_name || user?.last_name) {
    return [user.last_name, user.first_name].filter(Boolean).join(" ");
  }
  return user?.email ?? "Клиент";
}

export default function OperatorSupportPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] =
    useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasPseudonym, setHasPseudonym] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/operator/profile");
        const data = await res.json();
        if (res.ok) {
          setHasPseudonym(!!data.profile?.operator_pseudonym?.trim());
        }
      } catch {
        setHasPseudonym(false);
      }
    })();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = subscribeSupportInbox(supabase, {
      onMessage: () => {
        setNotice("Новое сообщение в чате");
        void loadConversations();
      },
      onConversation: () => {
        void loadConversations();
      },
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null);
      return;
    }
    const found = conversations.find((c) => c.id === selectedId) ?? null;
    setSelectedConversation(found);
  }, [selectedId, conversations]);

  const handleClaim = async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/chat/conversations/${selectedId}/claim`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Не удалось взять чат");
    }
    setSelectedConversation(data.conversation);
    await loadConversations();
  };

  const unassigned = conversations.filter((c) => !c.operator_id);
  const mine = conversations.filter(
    (c) => c.operator_id && c.operator_id === user?.id,
  );
  const others = conversations.filter(
    (c) => c.operator_id && c.operator_id !== user?.id,
  );

  function getAssignmentLabel(conversation: ChatConversation) {
    if (!conversation.operator_id) {
      return "Ожидает оператора";
    }
    if (conversation.operator_id === user?.id) {
      return "Ваш диалог";
    }
    const staffName = conversation.assigned_operator?.operator_pseudonym?.trim();
    return staffName ? `У оператора: ${staffName}` : "У другого оператора";
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <Bell className="w-4 h-4 shrink-0" />
          {notice}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs"
            onClick={() => setNotice(null)}
          >
            Скрыть
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-12rem)] min-h-[520px]">
        <div className="rounded-2xl border border-amber-200/70 bg-[#FFFDE7] overflow-hidden flex flex-col min-h-[280px] shadow-[0_4px_16px_rgba(255,221,45,0.06)]">
          <div className="px-4 py-3 border-b border-amber-200/60 bg-gradient-to-r from-[#FFF3B0] to-[#FFFEEB] font-bold text-zinc-900">
            Чаты поддержки
          </div>
          <div className="flex-1 overflow-y-auto bg-[#FFFEEB]/40">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFDD2D]" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-zinc-500 p-4">Нет открытых чатов</p>
            ) : (
              <>
                {unassigned.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Новые ({unassigned.length})
                  </div>
                )}
                {unassigned.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(conversation.id);
                      setNotice(null);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-amber-100/60 hover:bg-[#FFF3B0]/50 transition-colors ${
                      selectedId === conversation.id
                        ? "bg-[#FFF3B0] border-l-4 border-l-[#FFDD2D]"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <p className="text-sm font-bold text-zinc-900 truncate">
                      {getUserLabel(conversation)}
                    </p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">
                      Ожидает оператора
                    </p>
                  </button>
                ))}

                {mine.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Мои ({mine.length})
                  </div>
                )}
                {mine.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(conversation.id);
                      setNotice(null);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-amber-100/60 hover:bg-white/60 transition-colors ${
                      selectedId === conversation.id
                        ? "bg-[#FFF3B0] border-l-4 border-l-[#FFDD2D]"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <p className="text-sm font-bold text-zinc-900 truncate">
                      {getUserLabel(conversation)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-0.5 truncate">
                      {getAssignmentLabel(conversation)}
                    </p>
                  </button>
                ))}

                {others.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    У других операторов ({others.length})
                  </div>
                )}
                {others.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(conversation.id);
                      setNotice(null);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-amber-100/60 hover:bg-white/60 transition-colors ${
                      selectedId === conversation.id
                        ? "bg-[#FFF3B0] border-l-4 border-l-[#FFDD2D]"
                        : "border-l-4 border-l-transparent"
                    }`}
                  >
                    <p className="text-sm font-bold text-zinc-900 truncate">
                      {getUserLabel(conversation)}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">
                      {getAssignmentLabel(conversation)}
                    </p>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="min-h-[420px]">
          {selectedId && selectedConversation ? (
            <ChatPanel
              conversationId={selectedId}
              mode="operator"
              conversation={selectedConversation}
              onConversationChange={setSelectedConversation}
              showClaimButton={selectedConversation.operator_id !== user?.id}
              onClaim={handleClaim}
              canReply={hasPseudonym}
              currentOperatorId={user?.id ?? null}
            />
          ) : (
            <div className="h-full rounded-2xl border border-dashed border-amber-200/70 flex items-center justify-center text-sm text-amber-800/60 bg-[#FFFDE7]">
              Выберите чат из списка слева
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
