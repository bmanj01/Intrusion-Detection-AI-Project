import { createClient } from "@/lib/supabase/server";
import { withSupabaseReadRetry } from "@/lib/supabase/retry";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await withSupabaseReadRetry(() =>
    supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
  );

  if (error) {
    console.error("[v0] Error fetching analyses:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
