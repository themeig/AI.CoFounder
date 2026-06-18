import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const METRICS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-metrics.json");

const DEFAULT_METRICS = [
  {
    id: "metric-mrr-growth",
    title: "MRR Growth Trend",
    value: "$15,420",
    type: "currency",
    chartType: "line",
    data: [10200, 11500, 12100, 13400, 14200, 15420],
    labels: ["Genn", "Febb", "Mar", "Apr", "Mag", "Giu"],
    formula: "MRR Month-over-Month Growth",
    isDefault: true,
  },
  {
    id: "metric-ltv-cac",
    title: "LTV : CAC Ratio",
    value: "4.8x",
    type: "ratio",
    chartType: "gauge",
    data: [4.8],
    formula: "Customer Lifetime Value / Customer Acquisition Cost",
    isDefault: true,
  },
  {
    id: "metric-churn",
    title: "Monthly Churn Rate",
    value: "2.4%",
    type: "percentage",
    chartType: "bar",
    data: [3.1, 2.9, 2.7, 2.5, 2.4],
    labels: ["Febb", "Mar", "Apr", "Mag", "Giu"],
    formula: "Cancellazioni / Totale Utenti Attivi",
    isDefault: true,
  },
  {
    id: "metric-retention",
    title: "User Cohort Retention",
    value: "72%",
    type: "percentage",
    chartType: "cohort",
    cohortData: [
      { cohort: "Gen 26", size: 120, r1: 85, r2: 72, r3: 65 },
      { cohort: "Feb 26", size: 150, r1: 88, r2: 75, r3: 68 },
      { cohort: "Mar 26", size: 180, r1: 90, r2: 80, r3: 72 }
    ],
    formula: "Retention Cohort Decay (M1, M2, M3)",
    isDefault: true,
  }
];

// Helper to read JSON metrics db
async function getMetricsData() {
  try {
    const data = await fs.readFile(METRICS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    // If not found, write defaults and return
    await fs.mkdir(path.dirname(METRICS_FILE_PATH), { recursive: true });
    await fs.writeFile(METRICS_FILE_PATH, JSON.stringify(DEFAULT_METRICS, null, 2), "utf-8");
    return DEFAULT_METRICS;
  }
}

// Helper to write JSON metrics db
async function saveMetricsData(data: any) {
  await fs.mkdir(path.dirname(METRICS_FILE_PATH), { recursive: true });
  await fs.writeFile(METRICS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/demo/metrics
 * Returns all startup metrics.
 */
export async function GET() {
  try {
    const data = await getMetricsData();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/metrics
 * Adds a new custom metric card.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, value, type, chartType, formula, data, labels, cohortData, apiEndpoint } = body;

    if (!title || !value) {
      return NextResponse.json({ error: "Missing title or value" }, { status: 400 });
    }

    const currentMetrics = await getMetricsData();
    
    const newMetric = {
      id: "metric-custom-" + Date.now(),
      title,
      value,
      type: type || "integer",
      chartType: chartType || "value",
      formula: formula || "",
      data: Array.isArray(data) ? data : [],
      labels: Array.isArray(labels) ? labels : [],
      cohortData: Array.isArray(cohortData) ? cohortData : null,
      apiEndpoint: apiEndpoint || null,
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    currentMetrics.push(newMetric);
    await saveMetricsData(currentMetrics);

    return NextResponse.json(newMetric);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/demo/metrics
 * Modifies an existing custom metric.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, title, value, type, chartType, formula, data, labels, cohortData, apiEndpoint } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const currentMetrics = await getMetricsData();
    const metricIndex = currentMetrics.findIndex((m: any) => m.id === id);

    if (metricIndex === -1) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    const updated = {
      ...currentMetrics[metricIndex],
      ...(title !== undefined && { title }),
      ...(value !== undefined && { value }),
      ...(type !== undefined && { type }),
      ...(chartType !== undefined && { chartType }),
      ...(formula !== undefined && { formula }),
      ...(data !== undefined && { data }),
      ...(labels !== undefined && { labels }),
      ...(cohortData !== undefined && { cohortData }),
      ...(apiEndpoint !== undefined && { apiEndpoint }),
    };

    currentMetrics[metricIndex] = updated;
    await saveMetricsData(currentMetrics);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/metrics
 * Deletes a custom metric.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }

    const currentMetrics = await getMetricsData();
    const filtered = currentMetrics.filter((m: any) => m.id !== id);

    if (currentMetrics.length === filtered.length) {
      return NextResponse.json({ error: "Metric not found" }, { status: 404 });
    }

    await saveMetricsData(filtered);
    return NextResponse.json({ success: true, message: "Metric deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
