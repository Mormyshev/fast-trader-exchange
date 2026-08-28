import { NextResponse } from "next/server";
import { requireVerifier } from "@/src/utils/chat/auth";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { broadcastVerificationEvent } from "@/src/utils/supabase/broadcast-verification";
import { isStaffOnDuty, staffInactiveResponse } from "@/src/utils/staff/duty";

const VERIFICATION_TABS = ["pending", "verified", "rejected"] as const;
type VerificationTab = (typeof VERIFICATION_TABS)[number];

const PROFILE_FIELDS =
  "id, email, last_name, first_name, middle_name, document_number, phone, telegram, passport_url, selfie_url, extra_document_url, verification, verification_rejection_comment, updated_at";
const PROFILE_FIELDS_FALLBACK =
  "id, email, last_name, first_name, middle_name, phone, telegram, passport_url, verification, verification_rejection_comment, updated_at";

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

export async function GET(request: Request) {
  try {
    const actor = await requireVerifier();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tab = parseTab(new URL(request.url).searchParams.get("tab"));

    let { data, error } = await withTimeout(
      actor.admin
        .from("profiles")
        .select(PROFILE_FIELDS)
        .eq("verification", tab)
        .order("updated_at", { ascending: false })
        .limit(200),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (
      error &&
      /document_number|selfie_url|extra_document_url/i.test(error.message)
    ) {
      ({ data, error } = await withTimeout(
        actor.admin
          .from("profiles")
          .select(PROFILE_FIELDS_FALLBACK)
          .eq("verification", tab)
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
    const status = body.status;
    if (!id || (status !== "verified" && status !== "rejected")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const comment = normalizeComment(body.comment);
    if (status === "rejected" && !comment) {
      return NextResponse.json(
        { error: "Укажите причину отклонения" },
        { status: 400 },
      );
    }

    const updatePayload: Record<string, unknown> = {
      verification: status,
      updated_at: new Date().toISOString(),
      verification_rejection_comment:
        status === "rejected" ? comment : null,
    };

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

    return NextResponse.json({ ok: true, id: data?.id ?? id, status, profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
