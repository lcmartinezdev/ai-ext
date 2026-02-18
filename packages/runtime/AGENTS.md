# @ai-ext/runtime — Agent Instructions

You are working in the `@ai-ext/runtime` package. This provides the cross-agent runtime layer — an MCP-compatible server that ensures feature parity across hosts.

## Responsibilities

- Expose extension-defined tools via MCP protocol
- Emulate hooks for hosts without native support (KiloCode)
- Provide session and project-scoped memory via MCP tools and resources
- Handle tool execution (command, script, mcp-proxy implementations)

## Dependencies

- `@ai-ext/schema` — types (must be built first)
- `@ai-ext/core` — extension resolution (must be built first)
- `@modelcontextprotocol/sdk` — MCP server implementation

## File Guide

- `src/server.ts` — MCP server setup using `@modelcontextprotocol/sdk`. Registers handlers for `ListTools`, `CallTool`, `ListResources`, `ReadResource`. Routes tool calls to the appropriate handler (extension tools, hook emulation, or memory).
- `src/hook-engine.ts` — `HookEngine` class. `getEmulationTools()` returns MCP tool definitions for hooks that need runtime emulation. `executeEmulatedHook()` runs hook handlers and returns allow/deny decisions. Currently supports `command` type handlers; `prompt` and `agent` types are not yet implemented.
- `src/memory.ts` — `MemoryStore` class. Simple key-value store with two scopes: `session` (in-memory, ephemeral) and `project` (persisted to `.ai-ext/memory.json`). Exposed via MCP tools (`ai-ext_memory_read/write/list`) and resources (`ai-ext://memory/session`, `ai-ext://memory/project`).

## Key Design Decisions

1. **Stdio transport by default.** The MCP server runs on stdio, which is the most universally supported transport across hosts.
2. **Tool namespacing.** All tools are prefixed with `ai-ext_` to avoid conflicts with host-native tools.
3. **Hook exit codes follow Claude Code convention.** Exit 0 = pass, exit 2 = block, other = non-blocking warning.
4. **Memory persistence is JSON-based.** Simple and debuggable. Vector storage is planned for a future phase.

## Implementation Gaps (TODO)

- Hook engine: `prompt` handler type (needs LLM call)
- Hook engine: `agent` handler type (needs LLM call with tool access)
- Tool execution: `script` type needs better error handling
- Tool execution: `mcp-proxy` type not yet implemented
- Memory: `user` scope (global across projects)
- Memory: vector/embedding storage

## Common Tasks

### Add a new MCP tool

Add it to the `ListToolsRequestSchema` handler in `src/server.ts` and add execution logic in the `CallToolRequestSchema` handler.

### Add a new hook handler type

Extend the `executeHandler()` method in `src/hook-engine.ts`. For `prompt` and `agent` types, you'll need an LLM client.

### Add a new memory scope

Add the scope to `getStore()` in `src/memory.ts`. For persistent scopes, add load/persist logic.

## Build

```bash
bun run build   # Must build @ai-ext/schema and @ai-ext/core first
```
