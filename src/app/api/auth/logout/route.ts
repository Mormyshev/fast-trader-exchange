import { NextResponse } from "next/server";
import { createClient } from "@/src/utils/supabase/server";

/** Clears auth cookies on the server — client-only signOut leaves SSR session alive. */
export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // still return ok so UI can clear local state
  }

  return NextResponse.json({ ok: true });
}
