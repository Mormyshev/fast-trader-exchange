import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { clientPaysWithCrypto } from "@/src/utils/orders/payment-details";
import { stripOrderInternalFields } from "@/src/utils/orders/operator-snapshot";
import { createReceiptsSignedUrl } from "@/src/utils/orders/receipt-path";
import { isStaffOnDuty, staffInactiveResponse } from "@/src/utils/staff/duty";
import {
  isAllowedReceiptFile,
  isAllowedReceiptBytes,
  receiptContentTypeFromBytes,
  receiptFileExtFromBytes,
  receiptRejectMessage,
  receiptUploadKind,
} from "@/src/utils/orders/receipt-file";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const [{ data: order }, { data: profile }] = await Promise.all([
      admin.from("orders").select("*").eq("id", id).maybeSingle(),
      admin.from("profiles").select("role, staff_active").eq("id", user.id).maybeSingle(),
    ]);

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const isStaff =
      profile?.role === "operator" || profile?.role === "admin";
    const isOwner = order.user_id === user.id;
    if (!isOwner && isStaff && !isStaffOnDuty(profile)) {
      return staffInactiveResponse();
    }
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const signedUrl = await createReceiptsSignedUrl(
      admin,
      order.receipt_url as string | null,
    );
    if (!signedUrl) {
      return NextResponse.json({ error: "Чек не найден" }, { status: 404 });
    }

    return NextResponse.redirect(signedUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const user = await getUserFast(supabase);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Файл слишком большой (макс. 10 МБ)" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data: order, error: loadError } = await withTimeout(
      admin.from("orders").select("*").eq("id", id).maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 503 });
    }
    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (order.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (order.status !== "awaiting_payment") {
      return NextResponse.json(
        { error: "Чек можно прикрепить только на этапе оплаты" },
        { status: 400 },
      );
    }

    const kind = receiptUploadKind(clientPaysWithCrypto(order.currency_from));
    if (!isAllowedReceiptFile(file, kind)) {
      return NextResponse.json(
        { error: receiptRejectMessage(kind) },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isAllowedReceiptBytes(buffer, kind)) {
      return NextResponse.json(
        { error: receiptRejectMessage(kind) },
        { status: 400 },
      );
    }

    const ext = receiptFileExtFromBytes(buffer);
    const filePath = `${id}-${Date.now()}.${ext}`;

    const uploadResult = await withTimeout(
      admin.storage.from("receipts").upload(filePath, buffer, {
        contentType: receiptContentTypeFromBytes(buffer),
        upsert: true,
      }),
      15000,
      { data: null, error: { message: "Storage timeout" } } as any,
    );

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message },
        { status: 503 },
      );
    }

    const { data: updated, error: updateError } = await withTimeout(
      admin
        .from("orders")
        .update({ receipt_url: filePath })
        .eq("id", id)
        .select("*")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 503 });
    }

    return NextResponse.json({
      order: stripOrderInternalFields(updated as Record<string, unknown>),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
