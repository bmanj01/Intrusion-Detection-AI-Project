import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const [analysesResult, alertsResult] = await Promise.all([
      supabase.from("analyses").select("predicted_label"),
      supabase.from("alerts").select("id"),
    ]);

    if (analysesResult.error || alertsResult.error) {
      console.error("[stats] Query error", {
        analysesError: analysesResult.error,
        alertsError: alertsResult.error,
      });
      return NextResponse.json(
        { totalRequests: 0, anomalies: 0, normalTraffic: 0, totalAlerts: 0 },
        { status: 200 }
      );
    }

    const analyses = analysesResult.data || [];
    const totalRequests = analyses.length;
    const anomalies = analyses.filter((a) => String(a.predicted_label || "").toUpperCase() === "ANOMALY").length;
    const normalTraffic = analyses.filter((a) => String(a.predicted_label || "").toUpperCase() === "NORMAL").length;
    const totalAlerts = (alertsResult.data || []).length;

    return NextResponse.json({
      totalRequests,
      anomalies,
      normalTraffic,
      totalAlerts,
    });
  } catch (error) {
    console.error("[stats] Unexpected error", error);
    return NextResponse.json(
      { totalRequests: 0, anomalies: 0, normalTraffic: 0, totalAlerts: 0 },
      { status: 200 }
    );
  }
}
