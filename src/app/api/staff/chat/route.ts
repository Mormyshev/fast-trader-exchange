import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireStaff } from "@/src/utils/chat/auth";
import {
  buildStaffConversation,
  ensureGroupConversation,
  isStaffChatTableMissing,
  listStaffProfiles,
  loadLatestStaffMessages,
  loadStaffReads,
  mapStaffPeer,
  orderPeerIds,
  staffProfilesMap,
  type StaffChatConversation,
  type StaffChatPeer,
} from "@/src/utils/chat/staff-internal";
import { broadcastStaffChatConversation } from "@/src/utils/supabase/broadcast-staff-chat";

function tableMissingResponse() {
  return NextResponse.json(
    {
      error:
        "Таблица внутреннего чата ещё не создана. Выполните supabase/add_staff_chat.sql",
      code: "STAFF_CHAT_TABLE_MISSING",
    },
    { status: 503 },
  );
}

function sortPeers(a: StaffChatPeer, b: StaffChatPeer) {
  if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
  const nameA = (a.operator_pseudonym || a.email).toLocaleLowerCase("ru");
  const nameB = (b.operator_pseudonym || b.email).toLocaleLowerCase("ru");
  return nameA.localeCompare(nameB, "ru");
}

async function enrichRows(
  admin: any,
  rows: Array<{
    id: string;
    kind: string;
    created_at: string;
    updated_at: string;
    peer_a?: string | null;
    peer_b?: string | null;
  }>,
  currentUserId: string,
  profiles: Map<string, StaffChatPeer>,
): Promise<StaffChatConversation[]> {
  const ids = rows.map((row) => row.id);
  const [latest, reads] = await Promise.all([
    loadLatestStaffMessages(admin, ids),
    loadStaffReads(admin, currentUserId, ids),
  ]);

  return rows.map((row) =>
    buildStaffConversation(
      row,
      currentUserId,
      profiles,
      latest.get(row.id) ?? null,
      reads.get(row.id) ?? null,
    ),
  );
}

export async function GET() {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [groupRes, dmsRes, profilesRes] = await Promise.all([
      ensureGroupConversation(staff.admin),
      withTimeout(
        staff.admin
          .from("staff_conversations")
          .select("*")
          .eq("kind", "dm")
          .or(`peer_a.eq.${staff.user.id},peer_b.eq.${staff.user.id}`)
          .order("updated_at", { ascending: false }),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      ),
      listStaffProfiles(staff.admin),
    ]);

    const firstError =
      groupRes.error?.message ||
      dmsRes.error?.message ||
      profilesRes.error?.message;
    if (firstError && isStaffChatTableMissing(firstError)) {
      return tableMissingResponse();
    }
    if (groupRes.error || !groupRes.data) {
      return NextResponse.json(
        { error: groupRes.error?.message || "Не удалось открыть общий чат" },
        { status: 503 },
      );
    }
    if (dmsRes.error) {
      return NextResponse.json({ error: dmsRes.error.message }, { status: 503 });
    }
    if (profilesRes.error) {
      return NextResponse.json(
        { error: profilesRes.error.message },
        { status: 503 },
      );
    }

    const profiles = staffProfilesMap(profilesRes.data ?? []);
    const [group, dms] = await Promise.all([
      enrichRows(staff.admin, [groupRes.data], staff.user.id, profiles).then(
        (rows) => rows[0],
      ),
      enrichRows(
        staff.admin,
        (dmsRes.data ?? []) as Array<{
          id: string;
          kind: string;
          created_at: string;
          updated_at: string;
          peer_a?: string | null;
          peer_b?: string | null;
        }>,
        staff.user.id,
        profiles,
      ),
    ]);

    const dmPeerIds = new Set(
      dms.map((conversation) => conversation.peer?.id).filter(Boolean),
    );
    const peers = (profilesRes.data ?? [])
      .map(mapStaffPeer)
      .filter(
        (peer: StaffChatPeer) =>
          peer.id !== staff.user.id && !dmPeerIds.has(peer.id),
      )
      .sort(sortPeers);

    const unread =
      (group?.unread ? 1 : 0) + dms.filter((conversation) => conversation.unread).length;

    return NextResponse.json({ group, dms, peers, unread });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const staff = await requireStaff();
    if (!staff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const peerId =
      body && typeof body.peer_id === "string" ? body.peer_id.trim() : "";
    if (!peerId) {
      return NextResponse.json({ error: "Укажите сотрудника" }, { status: 400 });
    }
    if (peerId === staff.user.id) {
      return NextResponse.json(
        { error: "Нельзя написать себе" },
        { status: 400 },
      );
    }

    const { data: peerRow, error: peerError } = await withTimeout(
      staff.admin
        .from("profiles")
        .select("id, email, role, operator_pseudonym, staff_active")
        .eq("id", peerId)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (peerError) {
      if (isStaffChatTableMissing(peerError.message)) return tableMissingResponse();
      return NextResponse.json({ error: peerError.message }, { status: 503 });
    }
    if (!peerRow || (peerRow.role !== "operator" && peerRow.role !== "admin")) {
      return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    }

    const [peerA, peerB] = orderPeerIds(staff.user.id, peerId);
    const existing = await withTimeout(
      staff.admin
        .from("staff_conversations")
        .select("*")
        .eq("kind", "dm")
        .eq("peer_a", peerA)
        .eq("peer_b", peerB)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (existing.error) {
      if (isStaffChatTableMissing(existing.error.message)) {
        return tableMissingResponse();
      }
      return NextResponse.json({ error: existing.error.message }, { status: 503 });
    }

    let row = existing.data;
    if (!row) {
      const inserted = await withTimeout(
        staff.admin
          .from("staff_conversations")
          .insert({ kind: "dm", peer_a: peerA, peer_b: peerB })
          .select("*")
          .single(),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      );
      if (inserted.error || !inserted.data) {
        const retry = await withTimeout(
          staff.admin
            .from("staff_conversations")
            .select("*")
            .eq("kind", "dm")
            .eq("peer_a", peerA)
            .eq("peer_b", peerB)
            .maybeSingle(),
          8000,
          { data: null, error: { message: "Database timeout" } } as any,
        );
        row = retry.data;
        if (!row) {
          return NextResponse.json(
            { error: inserted.error?.message || "Не удалось создать чат" },
            { status: 503 },
          );
        }
      } else {
        row = inserted.data;
      }
    }

    const profiles = staffProfilesMap([
      mapStaffPeer(peerRow),
      {
        id: staff.user.id,
        email: staff.user.email ?? "",
        role: staff.profile.role,
        operator_pseudonym: staff.profile.operator_pseudonym,
        staff_active: staff.profile.staff_active,
      },
    ]);
    const [conversation] = await enrichRows(
      staff.admin,
      [row],
      staff.user.id,
      profiles,
    );

    void broadcastStaffChatConversation({ conversation });
    return NextResponse.json({ conversation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
