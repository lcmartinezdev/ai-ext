/**
 * @ai-ext/runtime — MCP Tool Server
 *
 * An MCP-compatible server that exposes:
 * - Canonical tools defined in the extension
 * - Hook emulation tools (for hosts lacking native hooks)
 * - Memory read/write tools
 *
 * This is the runtime bridge that ensures feature parity across hosts.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ExtensionIR, ToolDefinition } from "@ai-ext/schema";
import { HookEngine } from "./hook-engine.js";
import { MemoryStore } from "./memory.js";

export interface RuntimeServerOptions {
  /** The resolved extension IR */
  ir: ExtensionIR;
  /** Server name */
  name?: string;
  /** Server version */
  version?: string;
}

/**
 * Create and start the ai-ext runtime MCP server.
 */
export async function createRuntimeServer(
  options: RuntimeServerOptions
): Promise<Server> {
  const { ir, name = "ai-ext-runtime", version = "0.1.0" } = options;

  const hookEngine = new HookEngine(ir.hooks);
  const memoryStore = new MemoryStore();

  const server = new Server(
    { name, version },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // -----------------------------------------------------------------------
  // List Tools
  // -----------------------------------------------------------------------

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }> = [];

    // Extension-defined tools
    for (const tool of ir.tools) {
      tools.push({
        name: `ai-ext_${tool.metadata.name}`,
        description: tool.metadata.description,
        inputSchema: tool.parameters as unknown as Record<string, unknown>,
      });
    }

    // Hook emulation tools (for hosts without native hook support)
    const hookTools = hookEngine.getEmulationTools();
    tools.push(...hookTools);

    // Memory tools
    tools.push(
      {
        name: "ai-ext_memory_read",
        description: "Read a value from the ai-ext memory store",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "Memory key to read" },
            scope: {
              type: "string",
              enum: ["session", "project"],
              description: "Memory scope",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "ai-ext_memory_write",
        description: "Write a value to the ai-ext memory store",
        inputSchema: {
          type: "object",
          properties: {
            key: { type: "string", description: "Memory key to write" },
            value: { description: "Value to store" },
            scope: {
              type: "string",
              enum: ["session", "project"],
              description: "Memory scope",
            },
          },
          required: ["key", "value"],
        },
      },
      {
        name: "ai-ext_memory_list",
        description: "List all keys in the ai-ext memory store",
        inputSchema: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["session", "project"],
              description: "Memory scope",
            },
          },
        },
      }
    );

    return { tools };
  });

  // -----------------------------------------------------------------------
  // Call Tool
  // -----------------------------------------------------------------------

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;

    // Memory tools
    if (toolName === "ai-ext_memory_read") {
      const value = memoryStore.get(
        args?.key as string,
        (args?.scope as string) || "session"
      );
      return {
        content: [
          {
            type: "text" as const,
            text: value !== undefined ? JSON.stringify(value) : "null",
          },
        ],
      };
    }

    if (toolName === "ai-ext_memory_write") {
      memoryStore.set(
        args?.key as string,
        args?.value,
        (args?.scope as string) || "session"
      );
      return {
        content: [{ type: "text" as const, text: "OK" }],
      };
    }

    if (toolName === "ai-ext_memory_list") {
      const keys = memoryStore.list((args?.scope as string) || "session");
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(keys) },
        ],
      };
    }

    // Hook emulation tools
    if (toolName.startsWith("ai-ext_hook_")) {
      const result = await hookEngine.executeEmulatedHook(toolName, args);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    }

    // Extension-defined tools
    if (toolName.startsWith("ai-ext_")) {
      const canonicalName = toolName.replace("ai-ext_", "");
      const tool = ir.tools.find((t) => t.metadata.name === canonicalName);

      if (!tool) {
        return {
          content: [
            { type: "text" as const, text: `Unknown tool: ${toolName}` },
          ],
          isError: true,
        };
      }

      const result = await executeTool(tool, args);
      return {
        content: [{ type: "text" as const, text: result }],
      };
    }

    return {
      content: [
        { type: "text" as const, text: `Unknown tool: ${toolName}` },
      ],
      isError: true,
    };
  });

  // -----------------------------------------------------------------------
  // Resources (Memory as MCP resources)
  // -----------------------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: [
        {
          uri: "ai-ext://memory/session",
          name: "Session Memory",
          description: "Current session memory store",
          mimeType: "application/json",
        },
        {
          uri: "ai-ext://memory/project",
          name: "Project Memory",
          description: "Persistent project memory store",
          mimeType: "application/json",
        },
      ],
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === "ai-ext://memory/session") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(memoryStore.getAll("session")),
          },
        ],
      };
    }

    if (uri === "ai-ext://memory/project") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(memoryStore.getAll("project")),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  return server;
}

/**
 * Start the runtime server on stdio transport.
 */
export async function startRuntimeServer(
  options: RuntimeServerOptions
): Promise<void> {
  const server = await createRuntimeServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------

async function executeTool(
  tool: ToolDefinition,
  args: Record<string, unknown> | undefined
): Promise<string> {
  const impl = tool.implementation;

  if (impl.type === "command" && impl.command) {
    // Template the command with args
    let cmd = impl.command;
    if (args) {
      for (const [key, value] of Object.entries(args)) {
        cmd = cmd.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
      }
    }

    // Execute via shell
    const proc = Bun.spawn(["sh", "-c", cmd], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return `Error (exit ${exitCode}): ${stderr || stdout}`;
    }

    return stdout;
  }

  if (impl.type === "script" && impl.script) {
    const proc = Bun.spawn(["bun", "run", impl.script], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        AI_EXT_TOOL_ARGS: JSON.stringify(args || {}),
      },
    });

    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    return stdout;
  }

  return `Tool implementation type "${impl.type}" not yet supported`;
}
