import { withTimeout } from "@/src/utils/supabase/with-timeout";
import type { ChatConversation } from "@/src/utils/chat/types";
import { buildAssignedOperatorMeta, buildOperatorMeta } from "@/src/utils/chat/staff-chat";

export async function enrichConversations(
  admin: any,
  rows: Record<string, unknown>[],
): Promise<ChatConversation[]> {
  if (!rows.length) return [];

  const profileIds = new Set<string>();
  for (const row of rows) {
    if (typeof row.user_id === "string") profileIds.add(row.user_id);
    if (typeof row.operator_id === "string") profileIds.add(row.operator_id);
  }

  const { data: profiles } = await withTimeout(
    admin
      .from("profiles")
      .select("id, email, first_name, last_name, operator_pseudonym")
      .in("id", [...profileIds]),
    8000,
    { data: [], error: null } as any,
  );

  const byId = new Map<string, Record<string, unknown>>(
    (profiles ?? []).map((p: Record<string, unknown>) => [String(p.id), p]),
  );

  return rows.map((row) => {
    const user = byId.get(String(row.user_id));
    const operatorProfile = row.operator_id
      ? byId.get(String(row.operator_id))
      : null;

    return {
      id: String(row.id),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      user_id: String(row.user_id),
      operator_id: row.operator_id ? String(row.operator_id) : null,
      status: String(row.status),
      user: user
        ? {
            email: String(
              typeof user.email === "string" ? user.email : "",
            ),
            first_name:
              typeof user.first_name === "string" ? user.first_name : null,
            last_name:
              typeof user.last_name === "string" ? user.last_name : null,
          }
        : undefined,
      operator: buildOperatorMeta(row, operatorProfile),
      assigned_operator: buildAssignedOperatorMeta(row, operatorProfile),
    };
  });
}

export async function enrichConversation(
  admin: any,
  row: Record<string, unknown>,
): Promise<ChatConversation> {
  const [conversation] = await enrichConversations(admin, [row]);
  return conversation;
}
