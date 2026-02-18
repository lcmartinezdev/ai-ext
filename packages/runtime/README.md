# @ai-ext/runtime

Cross-agent runtime layer for the ai-ext platform — MCP server, hook engine, and memory store.

## Overview

The runtime is the **feature parity guarantee** of ai-ext. When a target host lacks native support for a feature (e.g., KiloCode has no hooks), the compiler injects a reference to this MCP server, which compensates at runtime.

It provides three capabilities:

1. **Tool Server** — Exposes canonical tools via the MCP protocol
2. **Hook Engine** — Emulates hooks as MCP tools for hosts without native hook support
3. **Memory Store** — Session and project-scoped key-value persistence

## Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | MCP server setup, request handlers for tools, memory, and resources |
| `src/hook-engine.ts` | Hook emulation: converts hooks into MCP tools with allow/deny responses |
| `src/memory.ts` | Key-value store with session (in-memory) and project (disk) scopes |
| `src/index.ts` | Public API |

## Usage

### Start as MCP Server (stdio)

```typescript
import { startRuntimeServer } from "@ai-ext/runtime";
import { resolveExtension } from "@ai-ext/core";

const { ir } = resolveExtension("./my-extension");

await startRuntimeServer({
  ir,
  name: "ai-ext-runtime",
  version: "0.1.0",
});
```

### Use Components Individually

```typescript
import { HookEngine, MemoryStore } from "@ai-ext/runtime";

// Hook engine
const engine = new HookEngine(hooks);
const tools = engine.getEmulationTools();
const result = await engine.executeEmulatedHook("ai-ext_hook_pre-tool-use", {
  toolName: "Edit",
});

// Memory store
const memory = new MemoryStore();
memory.set("last-review", { files: ["src/main.ts"] }, "session");
const value = memory.get("last-review", "session");
```

## MCP Tools Exposed

### Extension Tools

Each tool defined in the extension is exposed as `ai-ext_<name>`:

```
ai-ext_lint-check    → Runs the lint-check tool
ai-ext_test-runner   → Runs the test-runner tool
```

### Hook Emulation Tools

For each hook event with `mcp-tool` fallback strategy:

```
ai-ext_hook_pre-tool-use      → Call before tool use to check hooks
ai-ext_hook_user-prompt-submit → Call when processing user prompts
```

These tools return `{ allowed: boolean, reason?: string }`.

### Memory Tools

```
ai-ext_memory_read   → Read a value from memory
ai-ext_memory_write  → Write a value to memory
ai-ext_memory_list   → List all keys in a scope
```

## MCP Resources

```
ai-ext://memory/session   → Full session memory dump (JSON)
ai-ext://memory/project   → Full project memory dump (JSON)
```

## Memory Scopes

| Scope | Storage | Lifetime |
|-------|---------|----------|
| `session` | In-memory | Lost when server restarts |
| `project` | `.ai-ext/memory.json` | Persisted across sessions |

## Build

```bash
bun run build         # Bundle + declarations
bun run typecheck     # Type-check only
```

Depends on `@ai-ext/schema` and `@ai-ext/core`.
