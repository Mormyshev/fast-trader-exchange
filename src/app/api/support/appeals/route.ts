import { NextResponse } from "next/server";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { requireClient } from "@/src/utils/chat/auth";
import { getOrCreateClientConversation } from "@/src/utils/chat/client-conversation";
import {
  broadcastChatConversation,
  broadcastChatMessage,
} from "@/src/utils/supabase/broadcast-support";
import { enrichConversation } from "@/src/utils/chat/enrich-conversation";
import { hideInternalStaffNicks } from "@/src/utils/chat/staff-chat";
import {
  ALLOWED_CHAT_ATTACHMENT_TYPES,
  MAX_CHAT_ATTACHMENT_BYTES,
} from "@/src/utils/chat/types";
import {
  isOrderNumberColumnMissing,
} from "@/src/utils/orders/public-number";
import {
  buildSupportAppealMessage,
  parseAppealDescription,
  SUPPORT_APPEAL_MAX_FILES,
} from "@/src/utils/support/appeal";

const ORDER_SELECT =
  "id, user_id, order_number, status, amount_from, amount_to, currency_from, currency_to";
const ORDER_SELECT_FALLBACK =
  "id, user_id, status, amount_from, amount_to, currency_from, currency_to";

async function loadOwnOrder(
  admin: { from: (table: string) => any },
  orderId: string,
  userId: string,
) {
  const first = await withTimeout(
    admin.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );

  if (first.error && isOrderNumberColumnMissing(first.error)) {
    const fallback = await withTimeout(
      admin
        .from("orders")
        .select(ORDER_SELECT_FALLBACK)
        .eq("id", orderId)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (fallback.error) {
      return { order: null, error: fallback.error.message };
    }
    if (!fallback.data || fallback.data.user_id !== userId) {
      return { order: null, error: null };
    }
    return { order: fallback.data, error: null };
  }

  if (first.error) {
    return { order: null, error: first.error.message };
  }
  if (!first.data || first.data.user_id !== userId) {
    return { order: null, error: null };
  }
  return { order: first.data, error: null };
}

async function insertChatMessage(
  admin: { from: (table: string) => any },
  values: Record<string, unknown>,
) {
  return withTimeout(
    admin
      .from("chat_messages")
      .insert(values)
      .select(
        "id, created_at, conversation_id, sender_id, body, attachment_url, attachment_name, attachment_type",
      )
      .single(),
    8000,
    { data: null, error: { message: "Database timeout" } } as any,
  );
}

async function uploadAppealFile(
  admin: {
    from: (table: string) => any;
    storage: {
      from: (bucket: string) => {
        upload: (
          path: string,
          buffer: Buffer,
          options: { contentType: string; upsert: boolean },
        ) => Promise<{ error: { message: string } | null }>;
        getPublicUrl: (path: string) => { data: { publicUrl: string } };
      };
    };
  },
  conversationId: string,
  userId: string,
  file: File,
) {
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    return { error: `Файл «${file.name}» слишком большой (макс. 10 МБ)` };
  }
  if (!ALLOWED_CHAT_ATTACHMENT_TYPES.includes(file.type)) {
    return { error: `Неподдерживаемый тип файла: ${file.name}` };
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${conversationId}/${Date.now()}-${userId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("chat-attachments")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: publicUrlData } = admin.storage
    .from("chat-attachments")
    .getPublicUrl(path);

  const saved = await insertChatMessage(admin, {
    conversation_id: conversationId,
    sender_id: userId,
    body: null,
    attachment_url: publicUrlData.publicUrl,
    attachment_name: file.name,
    attachment_type: file.type,
  });

  if (saved.error || !saved.data) {
    return { error: saved.error?.message ?? "Не удалось сохранить вложение" };
  }

  return { message: saved.data };
}

export async function POST(request: Request) {
  try {
    const actor = await requireClient();
    if (!actor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await request.formData();
    const orderId =
      typeof form.get("order_id") === "string"
        ? String(form.get("order_id")).trim()
        : "";
    const parsed = parseAppealDescription(form.get("description"));

    if (!orderId) {
      return NextResponse.json({ error: "Не указана заявка" }, { status: 400 });
    }
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const files = form
      .getAll("files")
      .filter((item): item is File => item instanceof File && item.size > 0);

    if (files.length > SUPPORT_APPEAL_MAX_FILES) {
      return NextResponse.json(
        { error: `Можно прикрепить не больше ${SUPPORT_APPEAL_MAX_FILES} файлов` },
        { status: 400 },
      );
    }

    const { order, error: orderError } = await loadOwnOrder(
      actor.admin,
      orderId,
      actor.user.id,
    );
    if (orderError) {
      return NextResponse.json({ error: orderError }, { status: 503 });
    }
    if (!order) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    }

    const { data: profile } = await withTimeout(
      actor.admin
        .from("profiles")
        .select("last_name, first_name, middle_name, telegram, phone, email")
        .eq("id", actor.user.id)
        .maybeSingle(),
      5000,
      { data: null, error: null } as any,
    );

    const conversationResult = await getOrCreateClientConversation(
      actor.admin,
      actor.user.id,
    );
    if (!conversationResult.ok) {
      return NextResponse.json(
        { error: conversationResult.error },
        { status: 503 },
      );
    }

    const conversationId = String(conversationResult.row.id);
    const body = buildSupportAppealMessage({
      order,
      profile,
      email: actor.user.email,
      description: parsed.value,
    });

    const saved = await insertChatMessage(actor.admin, {
      conversation_id: conversationId,
      sender_id: actor.user.id,
      body,
    });

    if (saved.error || !saved.data) {
      return NextResponse.json(
        { error: saved.error?.message ?? "Не удалось отправить обращение" },
        { status: 503 },
      );
    }

    void broadcastChatMessage({
      message: saved.data,
      conversationId,
    });

    for (const file of files) {
      const uploaded = await uploadAppealFile(
        actor.admin,
        conversationId,
        actor.user.id,
        file,
      );
      if (uploaded.error || !uploaded.message) {
        return NextResponse.json(
          { error: uploaded.error ?? "Не удалось прикрепить файл" },
          { status: 400 },
        );
      }
      void broadcastChatMessage({
        message: uploaded.message,
        conversationId,
      });
    }

    await withTimeout(
      actor.admin
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId),
      5000,
      { data: null, error: null } as any,
    );

    const updated = await withTimeout(
      actor.admin
        .from("chat_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (updated.data) {
      const conversation = await enrichConversation(actor.admin, updated.data);
      void broadcastChatConversation({ conversation });
      return NextResponse.json({
        conversation: hideInternalStaffNicks(conversation),
      });
    }

    return NextResponse.json({ conversationId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
