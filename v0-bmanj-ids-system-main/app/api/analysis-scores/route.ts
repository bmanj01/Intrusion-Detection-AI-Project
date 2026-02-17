import { createClient } from "@/lib/supabase/server";
import { withSupabaseReadRetry } from "@/lib/supabase/retry";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await withSupabaseReadRetry(() =>
    supabase
      .from("analyses")
      .select("anomaly_score,predicted_label")
      .order("created_at", { ascending: false })
      .limit(1000)
  );

  if (error) {
    console.error("Error fetching analysis scores:", error);
    return NextResponse.json({ scores: [] }, { status: 200 });
  }

  const rows = data || [];
  const scores = rows
    .map((row) => Number(row.anomaly_score))
    .filter((n) => Number.isFinite(n));
  const normalScores = rows
    .filter((row) => String(row.predicted_label || "").toUpperCase() === "NORMAL")
    .map((row) => Number(row.anomaly_score))
    .filter((n) => Number.isFinite(n));

  return NextResponse.json({ scores, normalScores });
}
