import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

function normalizeLabel(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function p99(values: number[]): number {
  return quantile(values, 0.99);
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const idx = Math.floor(q * (sorted.length - 1));
  return sorted[idx];
}

async function computeThreshold() {
  const envPath = process.env.THRESHOLD_CALIBRATION_FILE;
  if (!envPath) {
    throw new Error("THRESHOLD_CALIBRATION_FILE is not set.");
  }
  const candidatePaths = [envPath];

  let csvPath: string | null = null;
  let csvText: string | null = null;

  for (const candidate of candidatePaths) {
    try {
      csvText = await fs.readFile(candidate, "utf8");
      csvPath = candidate;
      break;
    } catch {
      // Try next candidate path.
    }
  }

  if (!csvPath || !csvText) {
    throw new Error("Calibration CSV not found. Set THRESHOLD_CALIBRATION_FILE.");
  }

  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("Calibration CSV is empty or missing data rows.");
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const configuredScoreCol = process.env.THRESHOLD_SCORE_COLUMN || "anomaly_score";
  const scoreIdx = headers.findIndex((h) => h === configuredScoreCol);
  if (scoreIdx < 0) {
    throw new Error(`Calibration CSV must include '${configuredScoreCol}' column.`);
  }

  const configuredLabelCol = process.env.THRESHOLD_LABEL_COLUMN;
  const labelCandidates = configuredLabelCol
    ? [configuredLabelCol]
    : ["class", "label", "target", "ground_truth"];
  const labelIdx = headers.findIndex((h) => labelCandidates.includes(h));
  const normalLabels = (process.env.THRESHOLD_NORMAL_LABELS || "normal,benign")
    .split(",")
    .map((v) => normalizeLabel(v));
  const anomalyLabels = (process.env.THRESHOLD_ANOMALY_LABELS || "anomaly,malicious,outlier,attack")
    .split(",")
    .map((v) => normalizeLabel(v));
  const normalScoresRaw: number[] = [];
  const anomalyScoresRaw: number[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const score = Number(row[scoreIdx]);
    if (!Number.isFinite(score)) continue;

    if (labelIdx >= 0) {
      const label = normalizeLabel(row[labelIdx]);
      if (normalLabels.includes(label)) {
        normalScoresRaw.push(score);
      } else if (anomalyLabels.includes(label)) {
        anomalyScoresRaw.push(score);
      }
      continue;
    }

    normalScoresRaw.push(score);
  }

  if (!normalScoresRaw.length) {
    throw new Error("No normal rows found in calibration CSV.");
  }

  let useInverted = false;
  let normalScores = normalScoresRaw;

  if (anomalyScoresRaw.length > 0) {
    const nMed = quantile(normalScoresRaw, 0.5);
    const aMed = quantile(anomalyScoresRaw, 0.5);
    if (nMed > aMed) {
      useInverted = true;
      normalScores = normalScoresRaw.map((s) => 1 - s);
    }
  }

  const threshold = p99(normalScores);
  if (!Number.isFinite(threshold)) {
    throw new Error("Failed to compute p99 threshold from calibration CSV.");
  }

  const clamped = Math.min(0.99, Math.max(0.01, threshold));
  return {
    threshold: Number(clamped.toFixed(6)),
    sampleCount: normalScoresRaw.length,
    inverted: useInverted,
    source: csvPath,
  };
}

export async function GET() {
  try {
    const result = await computeThreshold();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calibration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await computeThreshold();
    const supabase = await createClient();
    const { error } = await supabase.from("settings").upsert(
      [
        { key: "anomalyThreshold", value: String(result.threshold) },
        { key: "autoSmartThreshold", value: "true" },
      ],
      { onConflict: "key" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      saved: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calibration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
