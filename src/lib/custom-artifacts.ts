import { promises as fs } from "fs";
import * as path from "path";

export interface Artifact {
  id: string;
  title: string;
  filename: string;
  code: string;
  language: string;
  type: 'code' | 'web' | 'data';
  logs?: string[];
  discussionId?: string;
  createdAt: string;
  updatedAt: string;
}

const ARTIFACTS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-artifacts.json");

export async function getArtifacts(): Promise<Artifact[]> {
  try {
    const data = await fs.readFile(ARTIFACTS_FILE_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveArtifacts(artifacts: Artifact[]): Promise<void> {
  await fs.mkdir(path.dirname(ARTIFACTS_FILE_PATH), { recursive: true });
  await fs.writeFile(ARTIFACTS_FILE_PATH, JSON.stringify(artifacts, null, 2), "utf-8");
}
