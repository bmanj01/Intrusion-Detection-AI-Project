"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Alert = {
  id: string;
  time: string;
  label: string;
  anomaly_score: number;
  severity: string;
  action: string;
  status: string;
  features: Record<string, number> | null;
  created_at: string;
};

export type Log = {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type Analysis = {
  id: string;
  input_features: Record<string, number>;
  predicted_label: string;
  anomaly_score: number;
  raw_proba: Record<string, number>;
  created_at: string;
};

export type Settings = {
  anomalyThreshold: number;
  autoCreateAlert: boolean;
  apiUrl: string;
  autoSmartThreshold: boolean;
};

// Alerts
export async function getAlerts(): Promise<Alert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("time", { ascending: false });

  if (error) {
    console.error("Error fetching alerts:", error);
    return [];
  }
  return data || [];
}

export async function createAlert(alert: Omit<Alert, "id" | "created_at">): Promise<Alert | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alerts")
    .insert(alert)
    .select()
    .single();

  if (error) {
    console.error("Error creating alert:", error);
    return null;
  }

  // Also create a log entry
  await createLog({
    type: "alert",
    message: `Alert created: ${alert.label} (${alert.severity})`,
    metadata: { alertId: data.id, severity: alert.severity },
  });

  revalidatePath("/");
  return data;
}

export async function updateAlertStatus(id: string, status: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("alerts")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Error updating alert:", error);
    return false;
  }

  await createLog({
    type: "status",
    message: `Alert status updated to: ${status}`,
    metadata: { alertId: id, newStatus: status },
  });

  revalidatePath("/");
  return true;
}

export async function deleteAlert(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("alerts").delete().eq("id", id);

  if (error) {
    console.error("Error deleting alert:", error);
    return false;
  }

  revalidatePath("/");
  return true;
}

// Logs
export async function getLogs(): Promise<Log[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error fetching logs:", error);
    return [];
  }
  return data || [];
}

export async function createLog(
  log: Omit<Log, "id" | "timestamp" | "created_at">
): Promise<Log | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("logs")
    .insert(log)
    .select()
    .single();

  if (error) {
    console.error("Error creating log:", error);
    return null;
  }
  return data;
}

export async function clearLogs(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    console.error("Error clearing logs:", error);
    return false;
  }

  revalidatePath("/");
  return true;
}

// Analyses
export async function getAnalyses(): Promise<Analysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error fetching analyses:", error);
    return [];
  }
  return data || [];
}

export async function createAnalysis(
  analysis: Omit<Analysis, "id" | "created_at">
): Promise<Analysis | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .insert(analysis)
    .select()
    .single();

  if (error) {
    console.error("Error creating analysis:", error);
    return null;
  }

  await createLog({
    type: "analysis",
    message: `Analysis completed: ${analysis.predicted_label} (score: ${analysis.anomaly_score.toFixed(2)})`,
    metadata: { analysisId: data.id, label: analysis.predicted_label },
  });

  revalidatePath("/");
  return data;
}

export async function getAnalysisScores(limit = 200): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analyses")
    .select("anomaly_score")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error("Error fetching analysis scores:", error);
    return [];
  }

  return data.map((row) => Number(row.anomaly_score)).filter((n) => Number.isFinite(n));
}

// Settings
export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("*");

  const defaults: Settings = {
    anomalyThreshold: 0.7,
    autoCreateAlert: true,
    apiUrl: "http://localhost:8000/predict",
    autoSmartThreshold: false,
  };

  if (error || !data) {
    console.error("Error fetching settings:", error);
    return defaults;
  }

  const settings: Settings = { ...defaults };
  for (const row of data) {
    if (row.key === "anomalyThreshold") {
      settings.anomalyThreshold = Number(row.value) || defaults.anomalyThreshold;
    } else if (row.key === "autoCreateAlert") {
      settings.autoCreateAlert = row.value === true || row.value === "true";
    } else if (row.key === "apiUrl") {
      settings.apiUrl = String(row.value).replace(/^"|"$/g, "");
    } else if (row.key === "autoSmartThreshold") {
      settings.autoSmartThreshold = row.value === true || row.value === "true";
    }
  }

  return settings;
}

export async function updateSettings(settings: Partial<Settings>): Promise<boolean> {
  const supabase = await createClient();

  const updates = Object.entries(settings).map(([key, value]) => ({
    key,
    value:
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value),
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from("settings")
      .upsert({ key: update.key, value: update.value }, { onConflict: "key" });

    if (error) {
      console.error("Error updating setting:", error);
      return false;
    }
  }

  await createLog({
    type: "settings",
    message: "Settings updated",
    metadata: settings,
  });

  revalidatePath("/");
  return true;
}

// Stats
export async function getStats() {
  const supabase = await createClient();

  const [alertsRes, analysesRes] = await Promise.all([
    supabase.from("alerts").select("*"),
    supabase.from("analyses").select("*"),
  ]);

  const alerts = alertsRes.data || [];
  const analyses = analysesRes.data || [];

  const totalRequests = analyses.length;
  const anomalies = alerts.length;
  const normalTraffic = analyses.filter((a) => a.predicted_label === "Normal").length;

  return {
    totalRequests,
    anomalies,
    normalTraffic,
    avgResponseTime: 45, // Mock for now
  };
}
