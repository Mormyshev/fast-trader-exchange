import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Принимаются только PDF" },
        { status: 400 },
      );
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

    const ext = file.name.split(".").pop() || "pdf";
    const filePath = `${id}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await withTimeout(
      admin.storage.from("receipts").upload(filePath, buffer, {
        contentType: "application/pdf",
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

    const {
      data: { publicUrl },
    } = admin.storage.from("receipts").getPublicUrl(filePath);

    const { data: updated, error: updateError } = await withTimeout(
      admin
        .from("orders")
        .update({ receipt_url: publicUrl })
        .eq("id", id)
        .select("*")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 503 });
    }

    return NextResponse.json({ order: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
