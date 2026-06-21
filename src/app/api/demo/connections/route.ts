import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";

const CONNECTIONS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-connections.json");

async function getConnectionsData() {
  try {
    const data = await fs.readFile(CONNECTIONS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    // If not found, return empty list
    return [];
  }
}

async function saveConnectionsData(data: any) {
  await fs.mkdir(path.dirname(CONNECTIONS_FILE_PATH), { recursive: true });
  await fs.writeFile(CONNECTIONS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/demo/connections
 * Returns all custom connections.
 */
export async function GET() {
  try {
    const data = await getConnectionsData();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/connections
 * Adds a new custom API connection.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, url, method, headers, bodyPayload, targetMetric, jsonPath, responseType, timeout } = body;

    if (!name || !url || !targetMetric) {
      return NextResponse.json({ error: "Missing name, url, or targetMetric" }, { status: 400 });
    }

    const current = await getConnectionsData();
    const newConn = {
      id: "conn-" + Date.now(),
      name,
      url,
      method: method || "GET",
      headers: headers || {},
      body: bodyPayload || null,
      targetMetric,
      jsonPath: jsonPath || "",
      responseType: responseType || "json",
      timeout: typeof timeout === "number" ? timeout : 5000,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    current.push(newConn);
    await saveConnectionsData(current);

    return NextResponse.json(newConn);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/demo/connections
 * Updates or toggles an existing connection.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name, url, method, headers, bodyPayload, targetMetric, jsonPath, responseType, timeout, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
    }

    const current = await getConnectionsData();
    const idx = current.findIndex((c: any) => c.id === id);

    if (idx === -1) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const updated = {
      ...current[idx],
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(method !== undefined && { method }),
      ...(headers !== undefined && { headers }),
      ...(bodyPayload !== undefined && { body: bodyPayload }),
      ...(targetMetric !== undefined && { targetMetric }),
      ...(jsonPath !== undefined && { jsonPath }),
      ...(responseType !== undefined && { responseType }),
      ...(timeout !== undefined && { timeout }),
      ...(isActive !== undefined && { isActive })
    };

    current[idx] = updated;
    await saveConnectionsData(current);

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/connections
 * Deletes a connection.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing connection id" }, { status: 400 });
    }

    const current = await getConnectionsData();
    const filtered = current.filter((c: any) => c.id !== id);

    if (current.length === filtered.length) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    await saveConnectionsData(filtered);
    return NextResponse.json({ success: true, message: "Connection deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
