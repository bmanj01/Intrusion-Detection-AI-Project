import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();

  const [analysesResult, alertsResult] = await Promise.all([
    supabase.from("analyses").select("predicted_label"),
    supabase.from("alerts").select("id"),
  ]);

  const analyses = analysesResult.data || [];
  const totalRequests = analyses.length;
  const anomalies = analyses.filter((a) => a.predicted_label === "ANOMALY").length;
  const normalTraffic = totalRequests - anomalies;
  const totalAlerts = (alertsResult.data || []).length;

  return NextResponse.json({
    totalRequests,
    anomalies,
    normalTraffic,
    totalAlerts,
  });
}
