"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeSupportInbox } from "@/src/utils/supabase/support-inbox";
import type { ChatConversation } from "@/src/utils/chat/types";
import ChatPanel from "@/src/components/Chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/src/app/context/AuthContext";
import StaffSearchInput, {
  matchesSearchQuery,
} from "@/src/components/staff/StaffSearchInput";
import {
  countUnreadClientMessages,
  getClientMessagePreview,
  loadStaffChatReadMap,
  markStaffChatRead,
} from "@/src/utils/chat/staff-inbox";

function getUserLabel(conversation: ChatConversation) {
  const user = conversation.user;
  if (user?.first_name || user?.last_name) {
    return [user.last_name, user.first_name].filter(Boolean).join(" ");
  }
  return user?.email ?? "Клиент";
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function ConversationRow({
  conversation,
  selected,
  preview,
  unread,
  subtitleClassName,
  onSelect,
}: {
  conversation: ChatConversation;
  selected: boolean;
  preview: string;
  unread: number;
  subtitleClassName: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-[#FFF8D6] transition-colors flex items-center gap-3 ${
        selected
          ? "bg-[#FFF4C2] border-l-4 border-l-[#FFDD2D]"
          : "border-l-4 border-l-transparent"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-bold text-zinc-900 truncate">
            {getUserLabel(conversation)}
          </p>
          {conversation.operator_id ? (
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                conversation.assigned_operator?.role === "admin"
                  ? "bg-violet-100 text-violet-800"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {conversation.assigned_operator?.role === "admin"
                ? "Админ"
                : "Поддержка"}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
              Ждёт
            </span>
          )}
        </div>
        <p className={`text-xs mt-0.5 truncate ${subtitleClassName}`}>
          {preview}
        </p>
      </div>
      <UnreadBadge count={unread} />
    </button>
  );
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
  const [readAtById, setReadAtById] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setReadAtById(loadStaffChatReadMap());
  }, []);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations ?? []);
      }
    } finally {
      if (!silent) setLoading(false);
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
          setHasPseudonym(!!data.profile?.chat_pseudonym?.trim());
        }
      } catch {
        setHasPseudonym(false);
      }
    })();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const inbox = subscribeSupportInbox(supabase, {
      onMessage: () => {
        setNotice("Новое сообщение в чате");
        void loadConversations(true);
      },
      onConversation: () => {
        void loadConversations(true);
      },
    });

    return () => {
      inbox.unsubscribe();
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(null);
      return;
    }
    const found = conversations.find((c) => c.id === selectedId) ?? null;
    setSelectedConversation(found);

    if (!found) return;
    const at = markStaffChatRead(found.id, found.last_message?.created_at);
    setReadAtById((prev) =>
      prev[found.id] === at ? prev : { ...prev, [found.id]: at },
    );
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

  function matchesConversation(conversation: ChatConversation) {
    return matchesSearchQuery(
      searchQuery,
      getUserLabel(conversation),
      conversation.user?.email,
      conversation.user?.first_name,
      conversation.user?.last_name,
      conversation.last_message?.body,
      conversation.last_message?.attachment_name,
      conversation.assigned_operator?.operator_pseudonym,
    );
  }

  const visibleUnassigned = unassigned.filter(matchesConversation);
  const visibleMine = mine.filter(matchesConversation);
  const visibleOthers = others.filter(matchesConversation);
  const hasVisibleChats =
    visibleUnassigned.length + visibleMine.length + visibleOthers.length > 0;

  function getAssignmentLabel(conversation: ChatConversation) {
    if (!conversation.operator_id) {
      return "Ожидает поддержки";
    }
    if (conversation.operator_id === user?.id) {
      return conversation.assigned_operator?.role === "admin"
        ? "Вы подключены · Администратор"
        : "Вы подключены · Техподдержка";
    }
    const staffName = conversation.assigned_operator?.operator_pseudonym?.trim();
    const isAdmin = conversation.assigned_operator?.role === "admin";
    if (staffName) {
      return isAdmin
        ? `Администратор: ${staffName}`
        : `Техподдержка: ${staffName}`;
    }
    return isAdmin ? "У администратора" : "У техподдержки";
  }

  function getPreview(conversation: ChatConversation) {
    return getClientMessagePreview(conversation) ?? getAssignmentLabel(conversation);
  }

  function getUnread(conversation: ChatConversation) {
    return countUnreadClientMessages(
      conversation,
      readAtById[conversation.id] ?? null,
    );
  }

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setNotice(null);
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 h-full min-h-0 overflow-hidden">
      {notice && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 sm:px-4 py-3 text-sm font-medium text-amber-900 shrink-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_1fr] xl:grid-cols-[minmax(0,20rem)_1fr] gap-3 sm:gap-4 lg:gap-5 flex-1 min-h-0 overflow-hidden">
        <div
          className={`rounded-2xl bg-white overflow-hidden flex flex-col h-full min-h-0 shadow-[0_4px_24px_rgba(15,23,42,0.04)] ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="px-4 py-3 border-b border-zinc-100 bg-[#FFF8D6] shrink-0 space-y-2.5">
            <p className="font-bold text-zinc-900">Служба поддержки</p>
            <StaffSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Имя, почта, сообщение"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFDD2D]" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-zinc-500 p-4">Нет открытых чатов</p>
            ) : !hasVisibleChats ? (
              <p className="text-sm text-zinc-500 p-4">
                Ничего не найдено. Измените запрос или очистите поиск.
              </p>
            ) : (
              <>
                {visibleUnassigned.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                    Новые ({visibleUnassigned.length})
                  </div>
                )}
                {visibleUnassigned.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedId === conversation.id}
                    preview={getPreview(conversation)}
                    unread={getUnread(conversation)}
                    subtitleClassName="text-amber-600 font-medium"
                    onSelect={selectConversation}
                  />
                ))}

                {visibleMine.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    Мои ({visibleMine.length})
                  </div>
                )}
                {visibleMine.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedId === conversation.id}
                    preview={getPreview(conversation)}
                    unread={getUnread(conversation)}
                    subtitleClassName="text-emerald-600"
                    onSelect={selectConversation}
                  />
                ))}

                {visibleOthers.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    У других ({visibleOthers.length})
                  </div>
                )}
                {visibleOthers.map((conversation) => (
                  <ConversationRow
                    key={conversation.id}
                    conversation={conversation}
                    selected={selectedId === conversation.id}
                    preview={getPreview(conversation)}
                    unread={getUnread(conversation)}
                    subtitleClassName="text-zinc-500"
                    onSelect={selectConversation}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        <div
          className={`h-full min-h-0 overflow-hidden flex flex-col ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedId && selectedConversation ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="lg:hidden mb-2 inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                К списку чатов
              </button>
              <div className="flex-1 min-h-0 overflow-hidden">
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
              </div>
            </>
          ) : (
            <div className="h-full min-h-0 rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] flex items-center justify-center text-sm text-zinc-400 px-6 text-center">
              Выберите чат из списка слева
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
