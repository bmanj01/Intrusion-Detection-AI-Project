import { NextResponse } from "next/server";
import { getSettings } from "@/app/actions";

export const dynamic = "force-dynamic";

type UpstreamResponse = {
  predicted_label?: string;
  anomaly_score?: number;
  raw_proba?: { anomaly?: number; normal?: number } | null;
};

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Use POST with { items: [{ features: ... }] }" },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const settings = await getSettings();
    const apiUrl = process.env.AI_API_URL || settings.apiUrl;

    if (!apiUrl) {
      return NextResponse.json(
        { error: "API URL not configured" },
        { status: 500 }
      );
    }

    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let data: UpstreamResponse | null = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error: "Upstream error",
          status: upstream.status,
          details: data ?? text,
        },
        { status: 502 }
      );
    }

    const payload =
      data &&
      typeof data === "object" &&
      Array.isArray((data as { results?: unknown }).results) &&
      (data as { results: unknown[] }).results.length > 0
        ? (data as { results: UpstreamResponse[] }).results[0]
        : data;

    const labelRaw = (payload?.predicted_label || "").toUpperCase();
    const predicted_label = labelRaw === "ANOMALY" ? "ANOMALY" : "NORMAL";

    const hasScore = typeof payload?.anomaly_score === "number";
    const hasProba =
      payload?.raw_proba &&
      typeof payload.raw_proba === "object" &&
      typeof payload.raw_proba.anomaly === "number" &&
      typeof payload.raw_proba.normal === "number";

    if (!hasScore && !hasProba) {
      return NextResponse.json(
        {
          error: "Upstream returned no score",
          details: data ?? text,
        },
        { status: 502 }
      );
    }

    const anomaly_score = hasScore ? payload!.anomaly_score! : payload!.raw_proba!.anomaly!;
    const raw_proba = hasProba
      ? payload!.raw_proba!
      : { anomaly: anomaly_score, normal: 1 - anomaly_score };

    const responseBody: Record<string, unknown> = { predicted_label, anomaly_score, raw_proba };
    if (process.env.DEBUG_PREDICT === "1") {
      responseBody.upstream = data ?? text;
    }

    return NextResponse.json(responseBody);
  } catch (err) {
    return NextResponse.json(
      { error: "Prediction failed", message: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
