import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*");

  if (error) {
    console.error("[v0] Error fetching settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Convert array of key-value pairs to object
  const settingsObj: Record<string, unknown> = {};
  for (const row of data || []) {
    settingsObj[row.key] = row.value;
  }

  return NextResponse.json({
    anomalyThreshold: settingsObj.anomalyThreshold ?? 0.7,
    autoCreateAlert: settingsObj.autoCreateAlert ?? true,
    apiUrl: settingsObj.apiUrl ?? "http://localhost:8000/predict",
  });
}
