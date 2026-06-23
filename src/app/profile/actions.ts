"use server";

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function uploadPassportAction(
  base64Data: string,
  fileName: string,
) {
  try {
    // Декодируем Base64 строку обратно в бинарный буфер
    const base64Image = base64Data.split(";base64,").pop();
    if (!base64Image) throw new Error("Неверный формат изображения");

    const buffer = Buffer.from(base64Image, "base64");

    // Определяем Content-Type
    const mimeType = base64Data.substring(
      base64Data.indexOf(":") + 1,
      base64Data.indexOf(";"),
    );

    // Загружаем напрямую в бакет
    const { error: uploadError } = await supabase.storage
      .from("verifications")
      .upload(fileName, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Получаем публичную ссылку
    const { data: urlData } = supabase.storage
      .from("verifications")
      .getPublicUrl(fileName);

    return { success: true, publicUrl: urlData.publicUrl };
  } catch (error: any) {
    console.error("Ошибка серверной загрузки:", error);
    return { success: false, error: error.message };
  }
}
