"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { createClient } from "@/src/utils/supabase/client";
import { subscribeStaffChatInbox } from "@/src/utils/supabase/staff-chat-inbox";
import {
  STAFF_TEAM_CHAT_READ_EVENT,
  staffDisplayName,
  type StaffChatConversation,
  type StaffChatPeer,
} from "@/src/utils/chat/staff-internal";
import StaffChatPanel from "@/src/components/Chat/StaffChatPanel";
import OperatorAvatar from "@/src/components/Chat/OperatorAvatar";
import StaffSearchInput, {
  matchesSearchQuery,
} from "@/src/components/staff/StaffSearchInput";

function UnreadDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="size-2 rounded-full bg-rose-500 shrink-0" />
  );
}

function messagePreview(conversation: StaffChatConversation) {
  const last = conversation.last_message;
  if (!last) return "Нет сообщений";
  if (last.body?.trim()) return last.body.trim();
  if (last.attachment_url) return last.attachment_name || "Файл";
  return "Нет сообщений";
}

function ChatRow({
  title,
  preview,
  selected,
  unread,
  icon,
  onSelect,
}: {
  title: string;
  preview: string;
  selected: boolean;
  unread: boolean;
  icon: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-[#FFF8D6] transition-colors flex items-center gap-3 ${
        selected
          ? "bg-[#FFF4C2] border-l-4 border-l-[#FFDD2D]"
          : "border-l-4 border-l-transparent"
      }`}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-zinc-900 truncate">{title}</p>
        <p
          className={`text-xs mt-0.5 truncate ${
            unread ? "text-zinc-800 font-semibold" : "text-zinc-500"
          }`}
        >
          {preview}
        </p>
      </div>
      <UnreadDot show={unread && !selected} />
    </button>
  );
}

export default function StaffTeamChatPage() {
  const [group, setGroup] = useState<StaffChatConversation | null>(null);
  const [dms, setDms] = useState<StaffChatConversation[]>([]);
  const [peers, setPeers] = useState<StaffChatPeer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<StaffChatConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingPeer, setOpeningPeer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const markRead = useCallback((conversationId: string) => {
    void fetch(`/api/staff/chat/${conversationId}/read`, { method: "POST" }).then(
      () => {
        window.dispatchEvent(new Event(STAFF_TEAM_CHAT_READ_EVENT));
      },
    );
    setGroup((prev) =>
      prev?.id === conversationId ? { ...prev, unread: false } : prev,
    );
    setDms((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread: false }
          : conversation,
      ),
    );
  }, []);

  const loadInbox = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/staff/chat", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить чаты");
      const nextGroup = (data.group ?? null) as StaffChatConversation | null;
      const nextDms = (data.dms ?? []) as StaffChatConversation[];
      const currentId = selectedIdRef.current;
      setGroup(
        nextGroup && currentId === nextGroup.id
          ? { ...nextGroup, unread: false }
          : nextGroup,
      );
      setDms(
        nextDms.map((conversation) =>
          conversation.id === currentId
            ? { ...conversation, unread: false }
            : conversation,
        ),
      );
      setPeers((data.peers ?? []) as StaffChatPeer[]);
      setError(null);
      if (currentId) markRead(currentId);
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить чаты");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [markRead]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const supabase = createClient();
    const inbox = subscribeStaffChatInbox(supabase, {
      onMessage: () => void loadInbox(true),
      onConversation: () => void loadInbox(true),
    });
    return () => inbox.unsubscribe();
  }, [loadInbox]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const found =
      (group?.id === selectedId ? group : null) ||
      dms.find((conversation) => conversation.id === selectedId) ||
      null;
    if (found) setSelected(found);
  }, [selectedId, group, dms]);

  useEffect(() => {
    if (!selectedId) return;
    markRead(selectedId);
  }, [selectedId, markRead]);

  const openPeer = async (peerId: string) => {
    setOpeningPeer(peerId);
    try {
      const res = await fetch("/api/staff/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peer_id: peerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось открыть чат");
      const conversation = data.conversation as StaffChatConversation;
      setSelectedId(conversation.id);
      setSelected(conversation);
      await loadInbox(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось открыть чат");
    } finally {
      setOpeningPeer(null);
    }
  };

  const handleConversationChange = (next: StaffChatConversation) => {
    setSelected(next);
    if (next.kind === "group") {
      setGroup(next);
      return;
    }
    setDms((prev) => {
      const without = prev.filter((conversation) => conversation.id !== next.id);
      return [next, ...without];
    });
  };

  const showGroup =
    !!group &&
    matchesSearchQuery(
      searchQuery,
      "Общий чат",
      "общий",
      messagePreview(group),
      group.last_message?.attachment_name,
    );

  const visibleDms = dms.filter((conversation) =>
    matchesSearchQuery(
      searchQuery,
      conversation.peer ? staffDisplayName(conversation.peer) : "Сотрудник",
      conversation.peer?.email,
      conversation.peer?.operator_pseudonym,
      conversation.peer?.role === "admin" ? "Администратор" : "Оператор",
      messagePreview(conversation),
      conversation.last_message?.attachment_name,
    ),
  );

  const visiblePeers = peers.filter((peer) =>
    matchesSearchQuery(
      searchQuery,
      staffDisplayName(peer),
      peer.email,
      peer.operator_pseudonym,
      peer.role === "admin" ? "Администратор" : "Оператор",
    ),
  );

  const hasVisibleChats =
    showGroup || visibleDms.length > 0 || visiblePeers.length > 0;

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:gap-5 h-full min-h-0 overflow-hidden">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shrink-0">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_1fr] xl:grid-cols-[minmax(0,20rem)_1fr] gap-3 sm:gap-4 lg:gap-5 flex-1 min-h-0 overflow-hidden">
        <div
          className={`rounded-2xl bg-white overflow-hidden flex flex-col h-full min-h-0 shadow-[0_4px_24px_rgba(15,23,42,0.04)] ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="px-4 py-3 border-b border-zinc-100 bg-[#FFF8D6] shrink-0 space-y-2.5">
            <p className="font-bold text-zinc-900">Чат команды</p>
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
            ) : !hasVisibleChats ? (
              <p className="text-sm text-zinc-500 p-4">
                {searchQuery.trim()
                  ? "Ничего не найдено. Измените запрос или очистите поиск."
                  : "Нет чатов"}
              </p>
            ) : (
              <>
                {showGroup && group ? (
                  <>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Общий
                    </div>
                    <ChatRow
                      title="Общий чат"
                      preview={messagePreview(group)}
                      selected={selectedId === group.id}
                      unread={group.unread}
                      icon={
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFDD2D] text-zinc-900 shrink-0">
                          <Users className="h-4 w-4" />
                        </div>
                      }
                      onSelect={() => setSelectedId(group.id)}
                    />
                  </>
                ) : null}

                {visibleDms.length > 0 ? (
                  <>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Личные
                    </div>
                    {visibleDms.map((conversation) => {
                      const name = conversation.peer
                        ? staffDisplayName(conversation.peer)
                        : "Сотрудник";
                      return (
                        <ChatRow
                          key={conversation.id}
                          title={name}
                          preview={messagePreview(conversation)}
                          selected={selectedId === conversation.id}
                          unread={conversation.unread}
                          icon={
                            <OperatorAvatar
                              name={name}
                              className="w-9 h-9"
                              profile={conversation.peer}
                            />
                          }
                          onSelect={() => setSelectedId(conversation.id)}
                        />
                      );
                    })}
                  </>
                ) : null}

                {visiblePeers.length > 0 ? (
                  <>
                    <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Написать
                    </div>
                    {visiblePeers.map((peer) => {
                      const name = staffDisplayName(peer);
                      return (
                        <button
                          key={peer.id}
                          type="button"
                          disabled={openingPeer === peer.id}
                          onClick={() => void openPeer(peer.id)}
                          className="w-full text-left px-4 py-3 border-b border-zinc-100 hover:bg-[#FFF8D6] transition-colors flex items-center gap-3 border-l-4 border-l-transparent"
                        >
                          <OperatorAvatar
                            name={name}
                            className="w-9 h-9"
                            profile={peer}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-zinc-900 truncate">
                              {name}
                            </p>
                            <p className="text-xs mt-0.5 text-zinc-400 truncate">
                              {peer.role === "admin" ? "Администратор" : "Оператор"}
                            </p>
                          </div>
                          {openingPeer === peer.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#C9A227]" />
                          ) : null}
                        </button>
                      );
                    })}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>

        <div
          className={`h-full min-h-0 overflow-hidden flex flex-col ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {selectedId && selected ? (
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
                <StaffChatPanel
                  conversation={selected}
                  onConversationChange={handleConversationChange}
                />
              </div>
            </>
          ) : (
            <div className="h-full min-h-0 rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] flex items-center justify-center text-sm text-zinc-400 px-6 text-center">
              Выберите общий чат или напишите коллеге
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
