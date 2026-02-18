/**
 * @ai-ext/runtime — Hook Engine
 *
 * Provides hook emulation for hosts that lack native hook support.
 * Exposes hooks as MCP tools that the agent is instructed to call
 * at appropriate lifecycle points.
 *
 * For example, a PreToolUse hook becomes an MCP tool named
 * "ai-ext_hook_pre-tool-use" that returns allow/deny decisions.
 */

import type { HookDefinition, HookHandler } from "@ai-ext/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookExecutionResult {
  /** Whether the action should proceed */
  allowed: boolean;
  /** Reason for the decision */
  reason?: string;
  /** Additional context for the agent */
  context?: string;
}

interface EmulationTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Hook Engine
// ---------------------------------------------------------------------------

export class HookEngine {
  private hooks: HookDefinition[];

  constructor(hooks: HookDefinition[]) {
    this.hooks = hooks;
  }

  /**
   * Get MCP tool definitions for hooks that need runtime emulation.
   * These tools allow hosts without native hook support to still
   * execute hook logic via tool calls.
   */
  getEmulationTools(): EmulationTool[] {
    const tools: EmulationTool[] = [];

    // Group hooks by event
    const eventGroups = new Map<string, HookDefinition[]>();
    for (const hook of this.hooks) {
      // Only emulate hooks with mcp-tool fallback (or no fallback specified, which defaults to mcp-tool)
      if (hook.fallback?.strategy === "ignore") continue;
      if (hook.fallback?.strategy === "skill-injection") continue;

      const existing = eventGroups.get(hook.event) || [];
      existing.push(hook);
      eventGroups.set(hook.event, existing);
    }

    for (const [event, hooks] of eventGroups) {
      const slugEvent = event
        .replace(/([A-Z])/g, "-$1")
        .toLowerCase()
        .replace(/^-/, "");

      tools.push({
        name: `ai-ext_hook_${slugEvent}`,
        description: this.buildToolDescription(event, hooks),
        inputSchema: this.buildToolSchema(event),
      });
    }

    return tools;
  }

  /**
   * Execute an emulated hook via its MCP tool interface.
   */
  async executeEmulatedHook(
    toolName: string,
    args: Record<string, unknown> | undefined
  ): Promise<HookExecutionResult> {
    // Extract event name from tool name
    const slugEvent = toolName.replace("ai-ext_hook_", "");
    const event = this.slugToEvent(slugEvent);

    // Find matching hooks
    const matchingHooks = this.hooks.filter((h) => {
      if (h.event !== event) return false;
      if (h.matcher && args?.toolName) {
        const regex = new RegExp(h.matcher);
        if (!regex.test(args.toolName as string)) return false;
      }
      return true;
    });

    if (matchingHooks.length === 0) {
      return { allowed: true, reason: "No matching hooks" };
    }

    // Execute handlers sequentially
    for (const hook of matchingHooks) {
      for (const handler of hook.handlers) {
        const result = await this.executeHandler(handler, args);
        if (!result.allowed) {
          return result;
        }
      }
    }

    return { allowed: true };
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async executeHandler(
    handler: HookHandler,
    args: Record<string, unknown> | undefined
  ): Promise<HookExecutionResult> {
    if (handler.type === "command" && handler.command) {
      try {
        const proc = Bun.spawn(["sh", "-c", handler.command], {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        });

        // Send context as JSON on stdin
        proc.stdin.write(JSON.stringify(args || {}));
        proc.stdin.end();

        const exitCode = await proc.exited;
        const stdout = await new Response(proc.stdout).text();

        if (exitCode === 0) {
          return { allowed: true, context: stdout || undefined };
        } else if (exitCode === 2) {
          // Exit code 2 = blocking error
          const stderr = await new Response(proc.stderr).text();
          return {
            allowed: false,
            reason: stderr || stdout || "Hook blocked the action",
          };
        } else {
          // Other exit codes = non-blocking error
          return { allowed: true, reason: `Hook warning: exit code ${exitCode}` };
        }
      } catch (err) {
        return {
          allowed: true,
          reason: `Hook execution error: ${(err as Error).message}`,
        };
      }
    }

    // For prompt/agent type hooks, we'd need an LLM call.
    // For now, pass through.
    return { allowed: true, reason: "Hook type not yet supported in runtime" };
  }

  private buildToolDescription(
    event: string,
    hooks: HookDefinition[]
  ): string {
    const descriptions = hooks
      .map((h) => h.metadata.description)
      .filter(Boolean);

    const hookNames = hooks.map((h) => h.metadata.name).join(", ");

    return `[ai-ext hook emulation] Call this BEFORE ${event} to check: ${descriptions.join("; ") || hookNames}. Returns {allowed: boolean, reason?: string}.`;
  }

  private buildToolSchema(event: string): Record<string, unknown> {
    const base: Record<string, unknown> = {
      type: "object",
      properties: {},
    };

    // Different schemas per event type
    if (
      event === "PreToolUse" ||
      event === "PostToolUse" ||
      event === "PostToolUseFailure"
    ) {
      base.properties = {
        toolName: {
          type: "string",
          description: "Name of the tool being called",
        },
        toolInput: {
          description: "Input arguments to the tool",
        },
      };
      base.required = ["toolName"];
    } else if (event === "UserPromptSubmit") {
      base.properties = {
        prompt: {
          type: "string",
          description: "The user prompt being submitted",
        },
      };
    } else {
      base.properties = {
        context: {
          type: "string",
          description: "Contextual information for the hook",
        },
      };
    }

    return base;
  }

  private slugToEvent(slug: string): string {
    // Convert kebab-case back to PascalCase
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("");
  }
}
