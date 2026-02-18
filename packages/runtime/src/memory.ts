/**
 * @ai-ext/runtime — Memory Store
 *
 * Simple key-value memory layer with scoping:
 * - session: In-memory only, lost when server restarts
 * - project: Persisted to disk (JSON file in .ai-ext/)
 *
 * Exposed via MCP tools and resources for cross-host memory portability.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export class MemoryStore {
  private sessionMemory: Map<string, unknown> = new Map();
  private projectMemory: Map<string, unknown> = new Map();
  private projectStorePath: string;

  constructor(projectDir?: string) {
    this.projectStorePath = join(
      projectDir || process.cwd(),
      ".ai-ext",
      "memory.json"
    );
    this.loadProjectMemory();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Get a value from memory.
   */
  get(key: string, scope: string = "session"): unknown {
    const store = this.getStore(scope);
    return store.get(key);
  }

  /**
   * Set a value in memory.
   */
  set(key: string, value: unknown, scope: string = "session"): void {
    const store = this.getStore(scope);
    store.set(key, value);

    if (scope === "project") {
      this.persistProjectMemory();
    }
  }

  /**
   * Delete a value from memory.
   */
  delete(key: string, scope: string = "session"): boolean {
    const store = this.getStore(scope);
    const result = store.delete(key);

    if (scope === "project") {
      this.persistProjectMemory();
    }

    return result;
  }

  /**
   * List all keys in a scope.
   */
  list(scope: string = "session"): string[] {
    const store = this.getStore(scope);
    return Array.from(store.keys());
  }

  /**
   * Get all key-value pairs in a scope.
   */
  getAll(scope: string = "session"): Record<string, unknown> {
    const store = this.getStore(scope);
    const result: Record<string, unknown> = {};
    for (const [key, value] of store) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Clear all values in a scope.
   */
  clear(scope: string = "session"): void {
    const store = this.getStore(scope);
    store.clear();

    if (scope === "project") {
      this.persistProjectMemory();
    }
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private getStore(scope: string): Map<string, unknown> {
    switch (scope) {
      case "project":
        return this.projectMemory;
      case "session":
      default:
        return this.sessionMemory;
    }
  }

  private loadProjectMemory(): void {
    try {
      if (existsSync(this.projectStorePath)) {
        const raw = readFileSync(this.projectStorePath, "utf-8");
        const data = JSON.parse(raw) as Record<string, unknown>;
        this.projectMemory = new Map(Object.entries(data));
      }
    } catch {
      // Ignore read errors, start with empty store
      this.projectMemory = new Map();
    }
  }

  private persistProjectMemory(): void {
    try {
      const dir = this.projectStorePath.replace(/\/[^/]+$/, "");
      mkdirSync(dir, { recursive: true });

      const data: Record<string, unknown> = {};
      for (const [key, value] of this.projectMemory) {
        data[key] = value;
      }
      writeFileSync(this.projectStorePath, JSON.stringify(data, null, 2), "utf-8");
    } catch {
      // Silently fail on write errors
    }
  }
}
