/**
 * @ai-ext/schema
 *
 * Canonical DSL types, validation, and JSON Schema definitions
 * for the Universal AI Agent Extension Platform.
 */

// Types
export type {
  // Common
  ComponentMetadata,
  PermissionPattern,
  ToolAccess,
  PermissionMode,
  MemoryScope,
  ModelSpec,
  TargetHost,

  // Manifest
  ExtensionManifest,

  // Skills
  SkillInvocation,
  SkillContext,
  SkillDefinition,

  // Agents
  McpServerRef,
  AgentDefinition,

  // Hooks
  HookEvent,
  HookHandlerType,
  HookHandler,
  HookFallbackStrategy,
  HookFallback,
  HookDefinition,

  // Tools
  ToolParameters,
  ToolParameterProperty,
  ToolImplementationType,
  ToolImplementation,
  ToolExposure,
  ToolDefinition,

  // Policies
  PermissionRules,
  SandboxConfig,
  PolicyDefinition,

  // IR
  ExtensionIR,

  // Compiler
  BuildOptions,
  BuildResult,
  BuildWarning,
  RuntimeRequirement,
} from "./types.js";

// Validation
export {
  validateManifest,
  validateSkill,
  validateAgent,
  validateHook,
  validateTool,
  validatePolicy,
  needsYamlQuotes,
  ensureYamlQuotes,
} from "./validator.js";

export type { ValidationResult, ValidationError } from "./validator.js";
