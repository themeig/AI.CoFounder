import { promises as fs } from "fs";
import * as path from "path";

export interface Discussion {
  id: string;
  startupId?: string;
  title: string;
  messages: any[];
  todos?: any[];
  createdAt: string;
  updatedAt: string;
}

const DISCUSSIONS_FILE_PATH = path.join(process.cwd(), "src/lib/custom-discussions.json");

export async function getDiscussions(startupId?: string): Promise<Discussion[]> {
  try {
    const data = await fs.readFile(DISCUSSIONS_FILE_PATH, "utf-8");
    const all: Discussion[] = JSON.parse(data);
    if (startupId) {
      return all.filter(d => d.startupId === startupId || !d.startupId);
    }
    return all;
  } catch {
    return [];
  }
}

export async function saveDiscussions(discussions: Discussion[]): Promise<void> {
  await fs.mkdir(path.dirname(DISCUSSIONS_FILE_PATH), { recursive: true });
  await fs.writeFile(DISCUSSIONS_FILE_PATH, JSON.stringify(discussions, null, 2), "utf-8");
}
