/**
 * @ai-ext/core
 *
 * Extension loader, parser, and resolver.
 * Transforms canonical DSL sources into a validated IR.
 */

// Loader
export {
  parseMarkdownFile,
  loadManifest,
  discoverComponents,
  discoverRules,
} from "./loader.js";
export type { ParsedComponent } from "./loader.js";

// Parsers
export {
  parseSkill,
  parseAgent,
  parseHook,
  parseTool,
  parsePolicy,
} from "./parser.js";

// Resolver
export { resolveExtension } from "./resolver.js";
export type { ResolveResult, ResolveError } from "./resolver.js";
