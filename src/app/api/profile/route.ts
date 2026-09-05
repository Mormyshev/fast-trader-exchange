import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { broadcastVerificationEvent } from "@/src/utils/supabase/broadcast-verification";
import { validateProfileFormFields } from "@/src/utils/validation";
import {
  formatClientBlacklistMessage,
  isProfileBlacklisted,
} from "@/src/utils/clients/blacklist";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function isExtraColumnMissing(message: string | null | undefined) {
  if (!message) return false;
  return (
    /document_number|selfie_url|extra_document_url/i.test(message) &&
    (/does not exist/i.test(message) || /schema cache/i.test(message))
  );
}

function readFile(form: FormData, key: string): File | null {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function uploadVerificationImage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  kind: string,
  file: File,
) {
  if (!ALLOWED_TYPES.includes(file.type) && file.type !== "image/jpg") {
    return { error: "Загрузите GIF, JPG или PNG" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "Файл слишком большой (макс. 20 МБ)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${kind}-${userId}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadResult = await withTimeout(
    admin.storage.from("verifications").upload(fileName, buffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
    }),
    20000,
    { data: null, error: { message: "Storage timeout" } } as any,
  );

  if (uploadResult.error) {
    return { error: uploadResult.error.message };
  }

  const { data: urlData } = admin.storage
    .from("verifications")
    .getPublicUrl(fileName);
  return { url: urlData.publicUrl };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    let { data, error } = await withTimeout(
      admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (!data) {
      const created = await withTimeout(
        admin
          .from("profiles")
          .insert({
            id: user.id,
            email: user.email,
            verification: "not_started",
            role: "user",
          })
          .select("*")
          .single(),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      );
      if (created.error) {
        return NextResponse.json(
          { error: created.error.message },
          { status: 503 },
        );
      }
      data = created.data;
    }

    return NextResponse.json({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const user = await getUserFast(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: currentProfile } = await withTimeout(
      admin
        .from("profiles")
        .select("is_blacklisted, blacklist_reason")
        .eq("id", user.id)
        .maybeSingle(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );
    if (isProfileBlacklisted(currentProfile)) {
      return NextResponse.json(
        { error: formatClientBlacklistMessage(currentProfile?.blacklist_reason) },
        { status: 403 },
      );
    }

    const lastName = String(form.get("last_name") || "").trim();
    const firstName = String(form.get("first_name") || "").trim();
    const middleName = String(form.get("middle_name") || "").trim();
    const documentNumber = String(form.get("document_number") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const telegram = String(form.get("telegram") || "").trim();

    const passportFile = readFile(form, "passport");
    const selfieFile = readFile(form, "selfie");
    const extraFile = readFile(form, "extra");
    let passportUrl = String(form.get("passport_url") || "").trim() || null;
    let selfieUrl = String(form.get("selfie_url") || "").trim() || null;
    let extraUrl = String(form.get("extra_document_url") || "").trim() || null;

    const profileValidation = validateProfileFormFields(
      {
        lastName,
        firstName,
        middleName,
        documentNumber,
        phone,
        telegram,
      },
      {
        hasPassport: Boolean(passportFile || passportUrl),
        hasSelfie: Boolean(selfieFile || selfieUrl),
      },
    );

    if (!profileValidation.ok) {
      const firstError =
        Object.values(profileValidation.errors).find(Boolean) ||
        "Некорректные данные";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    if (passportFile) {
      const uploaded = await uploadVerificationImage(
        admin,
        user.id,
        "passport",
        passportFile,
      );
      if (uploaded.error || !uploaded.url) {
        return NextResponse.json(
          { error: uploaded.error || "Не удалось загрузить документ" },
          { status: 503 },
        );
      }
      passportUrl = uploaded.url;
    }

    if (selfieFile) {
      const uploaded = await uploadVerificationImage(
        admin,
        user.id,
        "selfie",
        selfieFile,
      );
      if (uploaded.error || !uploaded.url) {
        return NextResponse.json(
          { error: uploaded.error || "Не удалось загрузить селфи" },
          { status: 503 },
        );
      }
      selfieUrl = uploaded.url;
    }

    if (extraFile) {
      const uploaded = await uploadVerificationImage(
        admin,
        user.id,
        "extra",
        extraFile,
      );
      if (uploaded.error || !uploaded.url) {
        return NextResponse.json(
          { error: uploaded.error || "Не удалось загрузить дополнительный файл" },
          { status: 503 },
        );
      }
      extraUrl = uploaded.url;
    }

    if (!passportUrl) {
      return NextResponse.json(
        { error: "Загрузите фото документа" },
        { status: 400 },
      );
    }
    if (!selfieUrl) {
      return NextResponse.json(
        { error: "Загрузите селфи с документом" },
        { status: 400 },
      );
    }

    const payload = {
      last_name: profileValidation.values.lastName,
      first_name: profileValidation.values.firstName,
      middle_name: profileValidation.values.middleName || null,
      document_number: profileValidation.values.documentNumber,
      phone: profileValidation.values.phone,
      telegram: profileValidation.values.telegram,
      passport_url: passportUrl,
      selfie_url: selfieUrl,
      extra_document_url: extraUrl,
      verification: "pending",
      verification_rejection_comment: null,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await withTimeout(
      admin
        .from("profiles")
        .update(payload)
        .eq("id", user.id)
        .select("*")
        .single(),
      8000,
      { data: null, error: { message: "Database timeout" } } as any,
    );

    if (error && isExtraColumnMissing(error.message)) {
      const fallback = { ...payload } as Record<string, unknown>;
      delete fallback.document_number;
      delete fallback.selfie_url;
      delete fallback.extra_document_url;
      ({ data, error } = await withTimeout(
        admin
          .from("profiles")
          .update(fallback)
          .eq("id", user.id)
          .select("*")
          .single(),
        8000,
        { data: null, error: { message: "Database timeout" } } as any,
      ));
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (data) {
      void broadcastVerificationEvent(data as Record<string, unknown>);
    }

    return NextResponse.json({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
