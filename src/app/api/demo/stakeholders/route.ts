import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as path from "path";

const STAKEHOLDERS_FILE_PATH = path.join(process.cwd(), "src/lib/stakeholders.json");

export interface StakeholderNodeData {
  id: string;
  label: string;
  cat: "hub" | "investitori" | "advisor" | "team" | "clienti" | "fornitori" | "partner";
  x: number;
  y: number;
  expanded?: boolean;
}

export interface StakeholderEdgeData {
  a: string;
  b: string;
}

const DEFAULT_STAKEHOLDERS_DATA = {
  nodes: [
    { id: "hub", label: "La tua startup", cat: "hub", x: 0, y: 0, expanded: true },
    { id: "investitori", label: "Investitori", cat: "investitori", x: 180, y: 0, expanded: true },
    { id: "advisor", label: "Advisor", cat: "advisor", x: 90, y: 156, expanded: true },
    { id: "team", label: "Team", cat: "team", x: -90, y: 156, expanded: true },
    { id: "clienti", label: "Clienti", cat: "clienti", x: -180, y: 0, expanded: true },
    { id: "fornitori", label: "Fornitori", cat: "fornitori", x: -90, y: -156, expanded: true },
    { id: "partner", label: "Partner", cat: "partner", x: 90, y: -156, expanded: true },
  ] as StakeholderNodeData[],
  edges: [
    { a: "hub", b: "investitori" },
    { a: "hub", b: "advisor" },
    { a: "hub", b: "team" },
    { a: "hub", b: "clienti" },
    { a: "hub", b: "fornitori" },
    { a: "hub", b: "partner" },
  ] as StakeholderEdgeData[]
};

async function getStakeholdersData() {
  try {
    const raw = await fs.readFile(STAKEHOLDERS_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    await fs.mkdir(path.dirname(STAKEHOLDERS_FILE_PATH), { recursive: true });
    await fs.writeFile(STAKEHOLDERS_FILE_PATH, JSON.stringify(DEFAULT_STAKEHOLDERS_DATA, null, 2), "utf-8");
    return DEFAULT_STAKEHOLDERS_DATA;
  }
}

async function saveStakeholdersData(data: { nodes: StakeholderNodeData[]; edges: StakeholderEdgeData[] }) {
  await fs.mkdir(path.dirname(STAKEHOLDERS_FILE_PATH), { recursive: true });
  await fs.writeFile(STAKEHOLDERS_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/demo/stakeholders
 * Returns nodes and edges.
 */
export async function GET() {
  try {
    const data = await getStakeholdersData();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/demo/stakeholders
 * Overwrites / saves complete graph (nodes and edges).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      return NextResponse.json({ error: "nodes ed edges devono essere array" }, { status: 400 });
    }

    const newData = {
      nodes: body.nodes,
      edges: body.edges
    };

    await saveStakeholdersData(newData);

    return NextResponse.json({
      success: true,
      message: "✓ Grafo stakeholder salvato con successo!",
      ...newData
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/stakeholders?id=xxx
 * Deletes a stakeholder node and its associated edges.
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || id === "hub") {
      return NextResponse.json({ error: "Impossibile eliminare l'Hub centrale." }, { status: 400 });
    }

    const data = await getStakeholdersData();
    const updatedNodes = data.nodes.filter((n: StakeholderNodeData) => n.id !== id);
    const updatedEdges = data.edges.filter((e: StakeholderEdgeData) => e.a !== id && e.b !== id);

    const newData = { nodes: updatedNodes, edges: updatedEdges };
    await saveStakeholdersData(newData);

    return NextResponse.json({
      success: true,
      message: "✓ Stakeholder eliminato con successo!",
      ...newData
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
