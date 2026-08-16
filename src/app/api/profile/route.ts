import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";
import { createAdminClient } from "@/src/utils/supabase/admin";
import { getUserFast } from "@/src/utils/supabase/get-user-fast";
import { withTimeout } from "@/src/utils/supabase/with-timeout";
import { broadcastVerificationEvent } from "@/src/utils/supabase/broadcast-verification";
import { validateProfileFormFields } from "@/src/utils/validation";

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
    const admin = createAdminClient();

    let lastName: string | null = null;
    let firstName: string | null = null;
    let middleName: string | null = null;
    let phone: string | null = null;
    let telegram: string | null = null;
    let passportUrl: string | null = null;
    let file: File | null = null;

    if (form) {
      lastName = String(form.get("last_name") || "").trim();
      firstName = String(form.get("first_name") || "").trim();
      middleName = String(form.get("middle_name") || "").trim();
      phone = String(form.get("phone") || "").trim();
      telegram = String(form.get("telegram") || "").trim();
      const existingUrl = String(form.get("passport_url") || "").trim();
      passportUrl = existingUrl || null;
      const maybeFile = form.get("passport");
      if (maybeFile instanceof File && maybeFile.size > 0) {
        file = maybeFile;
      }
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
      }
      lastName = String(body.last_name || "").trim();
      firstName = String(body.first_name || "").trim();
      middleName = String(body.middle_name || "").trim();
      phone = String(body.phone || "").trim();
      telegram = String(body.telegram || "").trim();
      passportUrl = body.passport_url ? String(body.passport_url) : null;
    }

    if (!lastName || !firstName || !phone || !telegram) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля" },
        { status: 400 },
      );
    }

    const profileValidation = validateProfileFormFields(
      {
        lastName,
        firstName,
        middleName,
        phone,
        telegram,
      },
      { hasPassport: Boolean(file || passportUrl) },
    );

    if (!profileValidation.ok) {
      const firstError =
        profileValidation.errors.lastName ||
        profileValidation.errors.firstName ||
        profileValidation.errors.middleName ||
        profileValidation.errors.phone ||
        profileValidation.errors.telegram ||
        profileValidation.errors.passport ||
        "Некорректные данные";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    ({
      lastName,
      firstName,
      middleName,
      phone,
      telegram,
    } = {
      lastName: profileValidation.values.lastName,
      firstName: profileValidation.values.firstName,
      middleName: profileValidation.values.middleName,
      phone: profileValidation.values.phone,
      telegram: profileValidation.values.telegram,
    });

    if (file) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "Паспорт: загрузите JPG, PNG или WEBP" },
          { status: 400 },
        );
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Файл слишком большой (макс. 10 МБ)" },
          { status: 400 },
        );
      }
    }

    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `passport-${user.id}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const uploadResult = await withTimeout(
        admin.storage.from("verifications").upload(fileName, buffer, {
          contentType: file.type || "image/jpeg",
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

      const { data: urlData } = admin.storage
        .from("verifications")
        .getPublicUrl(fileName);
      passportUrl = urlData.publicUrl;
    }

    if (!passportUrl) {
      return NextResponse.json(
        { error: "Загрузите фото паспорта" },
        { status: 400 },
      );
    }

    const { data, error } = await withTimeout(
      admin
        .from("profiles")
        .update({
          last_name: lastName,
          first_name: firstName,
          middle_name: middleName || null,
          phone,
          telegram,
          passport_url: passportUrl,
          verification: "pending",
          verification_rejection_comment: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select("*")
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

    return NextResponse.json({ profile: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
