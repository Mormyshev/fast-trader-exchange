import type { NextRequest } from "next/server";
import { handleAuthCallback } from "@/src/utils/supabase/handle-auth-callback";

export async function GET(request: NextRequest) {
  return handleAuthCallback(request);
}
