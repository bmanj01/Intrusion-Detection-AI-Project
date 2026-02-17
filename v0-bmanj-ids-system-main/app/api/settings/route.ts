import { createClient } from "@/lib/supabase/server";
import { withSupabaseReadRetry } from "@/lib/supabase/retry";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await withSupabaseReadRetry(() =>
    supabase.from("settings").select("*")
  );

  if (error) {
    console.error("[v0] Error fetching settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const defaults = {
    anomalyThreshold: 0.45,
    autoCreateAlert: true,
    apiUrl: "http://localhost:8000/predict",
    autoSmartThreshold: true,
  };

  const settingsObj: Record<string, unknown> = {};
  for (const row of data || []) {
    settingsObj[row.key] = row.value;
  }

  const anomalyThresholdRaw = settingsObj.anomalyThreshold ?? defaults.anomalyThreshold;
  const anomalyThreshold = Number(anomalyThresholdRaw);

  return NextResponse.json({
    anomalyThreshold: Number.isFinite(anomalyThreshold) ? anomalyThreshold : defaults.anomalyThreshold,
    autoCreateAlert:
      settingsObj.autoCreateAlert === true || settingsObj.autoCreateAlert === "true",
    autoSmartThreshold:
      settingsObj.autoSmartThreshold === true || settingsObj.autoSmartThreshold === "true",
    apiUrl: String(settingsObj.apiUrl ?? defaults.apiUrl).replace(/^"|"$/g, ""),
  });
}
