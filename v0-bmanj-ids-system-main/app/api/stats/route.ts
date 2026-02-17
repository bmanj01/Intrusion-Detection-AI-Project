import { createClient } from "@/lib/supabase/server";
import { withSupabaseReadRetry } from "@/lib/supabase/retry";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();

    const [totalAnalysesResult, anomalyAnalysesResult, normalAnalysesResult, totalAlertsResult] = await Promise.all([
      withSupabaseReadRetry(() =>
        supabase.from("analyses").select("id", { count: "exact", head: true })
      ),
      withSupabaseReadRetry(() =>
        supabase
          .from("analyses")
          .select("id", { count: "exact", head: true })
          .eq("predicted_label", "ANOMALY")
      ),
      withSupabaseReadRetry(() =>
        supabase
          .from("analyses")
          .select("id", { count: "exact", head: true })
          .eq("predicted_label", "NORMAL")
      ),
      withSupabaseReadRetry(() =>
        supabase.from("alerts").select("id", { count: "exact", head: true })
      ),
    ]);

    if (
      totalAnalysesResult.error ||
      anomalyAnalysesResult.error ||
      normalAnalysesResult.error ||
      totalAlertsResult.error
    ) {
      console.error("[stats] Query error", {
        totalAnalysesError: totalAnalysesResult.error,
        anomalyAnalysesError: anomalyAnalysesResult.error,
        normalAnalysesError: normalAnalysesResult.error,
        totalAlertsError: totalAlertsResult.error,
      });
      return NextResponse.json(
        { totalRequests: 0, anomalies: 0, normalTraffic: 0, totalAlerts: 0 },
        { status: 200 }
      );
    }

    const totalRequests = totalAnalysesResult.count ?? 0;
    const anomalies = anomalyAnalysesResult.count ?? 0;
    const normalTraffic = normalAnalysesResult.count ?? 0;
    const totalAlerts = totalAlertsResult.count ?? 0;

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
