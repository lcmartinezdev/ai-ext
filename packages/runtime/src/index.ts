/**
 * @ai-ext/runtime
 *
 * Cross-agent runtime layer:
 * - MCP-compatible tool server
 * - Hook emulation engine
 * - Memory store
 */

export { createRuntimeServer, startRuntimeServer } from "./server.js";
export type { RuntimeServerOptions } from "./server.js";

export { HookEngine } from "./hook-engine.js";
export type { HookExecutionResult } from "./hook-engine.js";

export { MemoryStore } from "./memory.js";
