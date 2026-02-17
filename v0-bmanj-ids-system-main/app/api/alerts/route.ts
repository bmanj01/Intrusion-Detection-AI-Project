import { createClient } from "@/lib/supabase/server";
import { withSupabaseReadRetry } from "@/lib/supabase/retry";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await withSupabaseReadRetry(() =>
    supabase
      .from("alerts")
      .select("*")
      .order("time", { ascending: false })
      .limit(200)
  );

  if (error) {
    console.error("[v0] Error fetching alerts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
