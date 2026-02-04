import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[v0] Error fetching logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
