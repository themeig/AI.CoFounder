export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface ToolContext {
  startupId: string;
  discussionId?: string;
  todos: any[];
  startup?: any;
  push?: (type: string, content: any) => void;
  settings?: any;
  delegations?: any[];
  setAgentSuggestion?: (suggestion: any) => void;
}

export interface ToolEntry {
  name: string;
  schema: ToolDefinition;
  handler: (args: any, context: ToolContext) => Promise<{ result: any; updatedTodos?: any[]; success?: boolean; details?: string }>;
  emoji: string;
}

export class ToolRegistry {
  private tools = new Map<string, ToolEntry>();

  register(entry: ToolEntry) {
    this.tools.set(entry.name, entry);
  }

  getDefinitions(names: Set<string>): any[] {
    const list: any[] = [];
    names.forEach(name => {
      const entry = this.tools.get(name);
      if (entry) {
        list.push(entry.schema);
      }
    });
    return list;
  }

  getEntry(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

export const registry = new ToolRegistry();
