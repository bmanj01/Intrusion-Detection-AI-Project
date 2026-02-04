import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("anomaly_score")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Error fetching analysis scores:", error);
    return NextResponse.json({ scores: [] }, { status: 200 });
  }

  const scores = (data || [])
    .map((row) => Number(row.anomaly_score))
    .filter((n) => Number.isFinite(n));

  return NextResponse.json({ scores });
}
