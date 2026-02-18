/**
 * @ai-ext/compiler
 *
 * Multi-target extension compiler.
 * Transforms canonical DSL → host-specific files.
 */

export { compile, getSupportedTargets, getTarget } from "./compiler.js";

// Targets
export { ClaudeTarget } from "./targets/claude.js";
export { KiloCodeTarget } from "./targets/kilocode.js";
export { OpenCodeTarget } from "./targets/opencode.js";

// Target interface
export type { CompilationTarget, TargetOutput } from "./targets/target.js";
