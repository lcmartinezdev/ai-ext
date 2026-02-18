/**
 * @ai-ext/schema — Validation utilities
 *
 * Validates parsed YAML/frontmatter against the canonical DSL types.
 * Uses runtime checks (not JSON Schema) for flexibility during development.
 * JSON Schema validation can be layered on top via the schemas/ directory.
 */

import type {
  ExtensionManifest,
  SkillDefinition,
  AgentDefinition,
  HookDefinition,
  ToolDefinition,
  PolicyDefinition,
  HookEvent,
  HookHandlerType,
  HookFallbackStrategy,
  PermissionMode,
  MemoryScope,
  ToolImplementationType,
} from "./types.js";

// ---------------------------------------------------------------------------
// Validation Result
// ---------------------------------------------------------------------------

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

function fail(errors: ValidationError[]): ValidationResult {
  const errs = errors.filter((e) => e.severity === "error");
  const warns = errors.filter((e) => e.severity === "warning");
  return { valid: errs.length === 0, errors: errs, warnings: warns };
}

function error(path: string, message: string): ValidationError {
  return { path, message, severity: "error" };
}

function warning(path: string, message: string): ValidationError {
  return { path, message, severity: "warning" };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_HOOK_EVENTS: HookEvent[] = [
  "SessionStart", "SessionEnd", "UserPromptSubmit",
  "PreToolUse", "PostToolUse", "PostToolUseFailure", "PermissionRequest",
  "SubagentStart", "SubagentStop", "Notification", "Stop", "TaskCompleted",
  "PreCompact", "FileEdited", "FileWatcherUpdated",
];

const VALID_HOOK_HANDLER_TYPES: HookHandlerType[] = ["command", "prompt", "agent"];

const VALID_FALLBACK_STRATEGIES: HookFallbackStrategy[] = [
  "mcp-tool", "skill-injection", "ignore",
];

const VALID_PERMISSION_MODES: PermissionMode[] = [
  "default", "acceptEdits", "dontAsk", "plan", "delegate", "bypassPermissions",
];

const VALID_MEMORY_SCOPES: MemoryScope[] = ["user", "project", "local", "session"];

const VALID_TOOL_IMPL_TYPES: ToolImplementationType[] = ["command", "script", "mcp-proxy"];

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateMetadata(
  data: Record<string, unknown>,
  prefix: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.name || typeof data.name !== "string") {
    errors.push(error(`${prefix}.name`, "name is required and must be a string"));
  } else {
    if (data.name.length > MAX_NAME_LENGTH) {
      errors.push(error(`${prefix}.name`, `name must be <= ${MAX_NAME_LENGTH} chars`));
    }
    if (!NAME_PATTERN.test(data.name)) {
      errors.push(
        error(`${prefix}.name`, "name must be lowercase alphanumeric with hyphens, starting with a letter")
      );
    }
  }

  if (!data.description || typeof data.description !== "string") {
    errors.push(error(`${prefix}.description`, "description is required and must be a string"));
  } else if (data.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      warning(`${prefix}.description`, `description exceeds ${MAX_DESCRIPTION_LENGTH} chars`)
    );
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateManifest(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return fail([error("manifest", "manifest must be an object")]);
  }

  const d = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (!d.name || typeof d.name !== "string") {
    errors.push(error("manifest.name", "name is required"));
  }
  if (!d.version || typeof d.version !== "string") {
    errors.push(error("manifest.version", "version is required"));
  }
  if (!d.description || typeof d.description !== "string") {
    errors.push(error("manifest.description", "description is required"));
  }

  return errors.length > 0 ? fail(errors) : ok();
}

export function validateSkill(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return fail([error("skill", "skill must be an object")]);
  }

  const d = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  // Metadata from frontmatter
  errors.push(...validateMetadata(d, "skill"));

  // Invocation
  if (d.invocation && typeof d.invocation === "object") {
    const inv = d.invocation as Record<string, unknown>;
    if (inv.userInvocable !== undefined && typeof inv.userInvocable !== "boolean") {
      errors.push(error("skill.invocation.userInvocable", "must be boolean"));
    }
    if (inv.modelInvocable !== undefined && typeof inv.modelInvocable !== "boolean") {
      errors.push(error("skill.invocation.modelInvocable", "must be boolean"));
    }
  }

  // Context
  if (d.context && typeof d.context === "object") {
    const ctx = d.context as Record<string, unknown>;
    if (ctx.mode && !["fork", "inline"].includes(ctx.mode as string)) {
      errors.push(error("skill.context.mode", "must be 'fork' or 'inline'"));
    }
  }

  return errors.length > 0 ? fail(errors) : ok();
}

export function validateAgent(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return fail([error("agent", "agent must be an object")]);
  }

  const d = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(...validateMetadata(d, "agent"));

  if (d.permissionMode && !VALID_PERMISSION_MODES.includes(d.permissionMode as PermissionMode)) {
    errors.push(
      error("agent.permissionMode", `must be one of: ${VALID_PERMISSION_MODES.join(", ")}`)
    );
  }

  if (d.memory && !VALID_MEMORY_SCOPES.includes(d.memory as MemoryScope)) {
    errors.push(error("agent.memory", `must be one of: ${VALID_MEMORY_SCOPES.join(", ")}`));
  }

  if (d.maxTurns !== undefined) {
    if (typeof d.maxTurns !== "number" || d.maxTurns < 1) {
      errors.push(error("agent.maxTurns", "must be a positive number"));
    }
  }

  return errors.length > 0 ? fail(errors) : ok();
}

export function validateHook(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return fail([error("hook", "hook must be an object")]);
  }

  const d = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(...validateMetadata(d, "hook"));

  if (!d.event || !VALID_HOOK_EVENTS.includes(d.event as HookEvent)) {
    errors.push(error("hook.event", `event is required and must be one of: ${VALID_HOOK_EVENTS.join(", ")}`));
  }

  if (!d.handlers || !Array.isArray(d.handlers) || d.handlers.length === 0) {
    errors.push(error("hook.handlers", "at least one handler is required"));
  } else {
    for (let i = 0; i < d.handlers.length; i++) {
      const h = d.handlers[i] as Record<string, unknown>;
      if (!h.type || !VALID_HOOK_HANDLER_TYPES.includes(h.type as HookHandlerType)) {
        errors.push(
          error(`hook.handlers[${i}].type`, `must be one of: ${VALID_HOOK_HANDLER_TYPES.join(", ")}`)
        );
      }
      if (h.type === "command" && !h.command) {
        errors.push(error(`hook.handlers[${i}].command`, "command is required for type 'command'"));
      }
      if ((h.type === "prompt" || h.type === "agent") && !h.prompt) {
        errors.push(error(`hook.handlers[${i}].prompt`, `prompt is required for type '${h.type}'`));
      }
    }
  }

  if (d.fallback && typeof d.fallback === "object") {
    const fb = d.fallback as Record<string, unknown>;
    if (!fb.strategy || !VALID_FALLBACK_STRATEGIES.includes(fb.strategy as HookFallbackStrategy)) {
      errors.push(
        error("hook.fallback.strategy", `must be one of: ${VALID_FALLBACK_STRATEGIES.join(", ")}`)
      );
    }
  }

  return errors.length > 0 ? fail(errors) : ok();
}

export function validateTool(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return fail([error("tool", "tool must be an object")]);
  }

  const d = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(...validateMetadata(d, "tool"));

  if (!d.parameters || typeof d.parameters !== "object") {
    errors.push(error("tool.parameters", "parameters schema is required"));
  } else {
    const params = d.parameters as Record<string, unknown>;
    if (params.type !== "object") {
      errors.push(error("tool.parameters.type", "parameters type must be 'object'"));
    }
  }

  if (!d.implementation || typeof d.implementation !== "object") {
    errors.push(error("tool.implementation", "implementation is required"));
  } else {
    const impl = d.implementation as Record<string, unknown>;
    if (!impl.type || !VALID_TOOL_IMPL_TYPES.includes(impl.type as ToolImplementationType)) {
      errors.push(
        error("tool.implementation.type", `must be one of: ${VALID_TOOL_IMPL_TYPES.join(", ")}`)
      );
    }
    if (impl.type === "command" && !impl.command) {
      errors.push(error("tool.implementation.command", "command is required for type 'command'"));
    }
    if (impl.type === "script" && !impl.script) {
      errors.push(error("tool.implementation.script", "script is required for type 'script'"));
    }
    if (impl.type === "mcp-proxy" && !impl.mcpProxy) {
      errors.push(error("tool.implementation.mcpProxy", "mcpProxy is required for type 'mcp-proxy'"));
    }
  }

  return errors.length > 0 ? fail(errors) : ok();
}

export function validatePolicy(data: unknown): ValidationResult {
  if (!data || typeof data !== "object") {
    return fail([error("policy", "policy must be an object")]);
  }

  const d = data as Record<string, unknown>;
  const errors: ValidationError[] = [];

  errors.push(...validateMetadata(d, "policy"));

  if (d.permissions && typeof d.permissions === "object") {
    const perms = d.permissions as Record<string, unknown>;
    for (const key of ["allow", "deny", "ask"]) {
      if (perms[key] && !Array.isArray(perms[key])) {
        errors.push(error(`policy.permissions.${key}`, "must be an array of permission patterns"));
      }
    }
  }

  return errors.length > 0 ? fail(errors) : ok();
}
