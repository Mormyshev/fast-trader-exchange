import { NextResponse } from "next/server";
import { isClientRole, requireVerifier } from "@/src/utils/chat/auth";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { broadcastVerificationEvent } from "@/src/utils/supabase/broadcast-verification";
import { isStaffOnDuty, staffInactiveResponse } from "@/src/utils/staff/duty";
import {
  isBlacklistColumnMissing,
  parseBlacklistReason,
} from "@/src/utils/clients/blacklist";

const VERIFICATION_TABS = [
  "pending",
  "verified",
  "rejected",
  "blacklisted",
] as const;
type VerificationTab = (typeof VERIFICATION_TABS)[number];

const PROFILE_FIELDS =
  "id, email, role, last_name, first_name, middle_name, document_number, phone, telegram, passport_url, selfie_url, extra_document_url, verification, verification_rejection_comment, updated_at, is_blacklisted, blacklist_reason, blacklisted_at";
const PROFILE_FIELDS_FALLBACK =
  "id, email, role, last_name, first_name, middle_name, phone, telegram, passport_url, verification, verification_rejection_comment, updated_at";

function parseTab(value: string | null): VerificationTab {
  if (value && VERIFICATION_TABS.includes(value as VerificationTab)) {
    return value as VerificationTab;
  }
  return "pending";
}

function normalizeComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 1000);
}

function applyClientListFilters(query: any, tab: VerificationTab) {
  if (tab === "blacklisted") {
    return query.eq("is_blacklisted", true);
  }
  return query.eq("verification", tab).eq("is_blacklisted", false);
}

export async function GET(request: Request) {
  try {
    const actor = await requireVerifier();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tab = parseTab(new URL(request.url).searchParams.get("tab"));

    let { data, error } = await withTimeout(
      applyClientListFilters(
        actor.admin.from("profiles").select(PROFILE_FIELDS),
        tab,
      )
        .order("updated_at", { ascending: false })
        .limit(200),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error && isBlacklistColumnMissing(error.message) && tab === "blacklisted") {
      return NextResponse.json({ requests: [], tab });
    }

    if (
      error &&
      (/document_number|selfie_url|extra_document_url/i.test(error.message) ||
        isBlacklistColumnMissing(error.message))
    ) {
      ({ data, error } = await withTimeout(
        actor.admin
          .from("profiles")
          .select(PROFILE_FIELDS_FALLBACK)
          .eq("verification", tab === "blacklisted" ? "verified" : tab)
          .order("updated_at", { ascending: false })
          .limit(200),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      ));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    return NextResponse.json({ requests: data ?? [], tab });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireVerifier();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isStaffOnDuty(actor.profile)) {
      return staffInactiveResponse();
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { data: current, error: loadError } = await withTimeout(
      actor.admin
        .from("profiles")
        .select("id, role")
        .eq("id", id)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (loadError && !isBlacklistColumnMissing(loadError.message)) {
      return NextResponse.json({ error: loadError.message }, { status: 503 });
    }

    const target = current as
      | { id: string; role?: string | null; is_blacklisted?: boolean | null }
      | null;

    if (!target) {
      return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
    }

    const action = body.action;
    if (action === "blacklist" || action === "unblacklist") {
      if (!isClientRole(target.role) && target.role != null) {
        return NextResponse.json(
          { error: "В черный список можно внести только клиента" },
          { status: 400 },
        );
      }
      if (target.id === actor.user.id) {
        return NextResponse.json(
          { error: "Нельзя изменить свой аккаунт" },
          { status: 400 },
        );
      }
    }
    let updatePayload: Record<string, unknown>;

    if (action === "blacklist") {
      const reason = parseBlacklistReason(body.reason);
      if (!reason.ok) {
        return NextResponse.json({ error: reason.error }, { status: 400 });
      }
      updatePayload = {
        is_blacklisted: true,
        blacklist_reason: reason.value,
        blacklisted_at: new Date().toISOString(),
        blacklisted_by: actor.user.id,
        updated_at: new Date().toISOString(),
      };
    } else if (action === "unblacklist") {
      updatePayload = {
        is_blacklisted: false,
        blacklist_reason: null,
        blacklisted_at: null,
        blacklisted_by: null,
        updated_at: new Date().toISOString(),
      };
    } else {
      const status = body.status;
      if (status !== "verified" && status !== "rejected") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const comment = normalizeComment(body.comment);
      if (status === "rejected" && !comment) {
        return NextResponse.json(
          { error: "Укажите причину отклонения" },
          { status: 400 },
        );
      }

      updatePayload = {
        verification: status,
        updated_at: new Date().toISOString(),
        verification_rejection_comment:
          status === "rejected" ? comment : null,
      };
    }

    const { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .update(updatePayload)
        .eq("id", id)
        .select(PROFILE_FIELDS)
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (data) {
      void broadcastVerificationEvent(data as Record<string, unknown>);
    }

    return NextResponse.json({
      ok: true,
      id: data?.id ?? id,
      action: action ?? body.status,
      profile: data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
