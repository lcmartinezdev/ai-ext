/**
 * ai-ext serve — Start the runtime MCP server
 */

import { resolve } from "node:path";
import { resolveExtension } from "@ai-ext/core";
import { startRuntimeServer } from "@ai-ext/runtime";

export interface ServeCommandOptions {
  /** Directory containing the extension */
  dir: string;
}

export async function serveRuntime(
  options: ServeCommandOptions
): Promise<void> {
  const dir = resolve(options.dir);

  // Resolve the extension
  const { ir, valid, errors } = resolveExtension(dir);

  if (!valid) {
    const errMsgs = errors
      .filter((e) => e.severity === "error")
      .map((e) => `  ${e.component}: ${e.message}`)
      .join("\n");
    console.error(`Extension validation failed:\n${errMsgs}`);
    process.exit(1);
  }

  // Log what the server will expose
  const toolCount = ir.tools.length;
  const hookCount = ir.hooks.length;
  console.error(
    `ai-ext runtime server starting (${toolCount} tools, ${hookCount} hooks)...`
  );

  // Start MCP server on stdio
  await startRuntimeServer({
    ir,
    name: `ai-ext-runtime:${ir.manifest.name}`,
    version: ir.manifest.version,
  });
}
