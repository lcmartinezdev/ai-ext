/**
 * @ai-ext/core — Component Parsers
 *
 * Transform parsed frontmatter + body into canonical DSL types.
 * Each parser handles the mapping from YAML frontmatter fields
 * to the strongly-typed IR components.
 */

import type {
  SkillDefinition,
  AgentDefinition,
  HookDefinition,
  ToolDefinition,
  PolicyDefinition,
  ComponentMetadata,
  SkillInvocation,
  SkillContext,
  ToolAccess,
  HookHandler,
  HookFallback,
  ToolParameters,
  ToolImplementation,
  ToolExposure,
  PermissionRules,
  SandboxConfig,
  McpServerRef,
  HookEvent,
  PermissionMode,
  MemoryScope,
  ModelSpec,
} from "@ai-ext/schema";

import type { ParsedComponent } from "./loader.js";

// ---------------------------------------------------------------------------
// Metadata Extraction
// ---------------------------------------------------------------------------

function extractMetadata(fm: Record<string, unknown>): ComponentMetadata {
  return {
    name: fm.name as string,
    description: fm.description as string,
    license: fm.license as string | undefined,
    compatibility: fm.compatibility as string | undefined,
    metadata: fm.metadata as Record<string, unknown> | undefined,
    tags: fm.tags as string[] | undefined,
  };
}

// ---------------------------------------------------------------------------
// Tool Access Extraction
// ---------------------------------------------------------------------------

function extractToolAccess(fm: Record<string, unknown>): ToolAccess | undefined {
  // Support both flat "allowed-tools" (Agent Skills spec) and structured "tools" object
  const allowedTools = fm["allowed-tools"] || fm.allowedTools;
  const tools = fm.tools as Record<string, unknown> | undefined;

  if (allowedTools && typeof allowedTools === "string") {
    // Agent Skills spec: space-delimited string
    return {
      allowed: allowedTools.split(/\s+/).filter(Boolean),
    };
  }

  if (tools && typeof tools === "object") {
    return {
      allowed: tools.allowed as string[] | undefined,
      disallowed: tools.disallowed as string[] | undefined,
    };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Skill Parser
// ---------------------------------------------------------------------------

export function parseSkill(component: ParsedComponent): SkillDefinition {
  const { frontmatter: fm, body } = component;

  const invocation: SkillInvocation = {};
  if (fm["user-invocable"] !== undefined || fm.userInvocable !== undefined) {
    invocation.userInvocable = (fm["user-invocable"] ?? fm.userInvocable) as boolean;
  }
  if (fm["disable-model-invocation"] !== undefined || fm.modelInvocable !== undefined) {
    // Agent Skills spec uses disable-model-invocation (inverted)
    if (fm["disable-model-invocation"] !== undefined) {
      invocation.modelInvocable = !(fm["disable-model-invocation"] as boolean);
    } else {
      invocation.modelInvocable = fm.modelInvocable as boolean;
    }
  }
  if (fm["argument-hint"] || fm.argumentHint) {
    invocation.argumentHint = (fm["argument-hint"] || fm.argumentHint) as string;
  }

  const context: SkillContext = {};
  if (fm.context) {
    if (typeof fm.context === "string") {
      context.mode = fm.context as "fork" | "inline";
    } else if (typeof fm.context === "object") {
      const ctx = fm.context as Record<string, unknown>;
      context.mode = ctx.mode as "fork" | "inline" | undefined;
      context.agent = ctx.agent as string | undefined;
      context.model = ctx.model as ModelSpec | undefined;
    }
  }
  if (fm.agent) context.agent = fm.agent as string;
  if (fm.model) context.model = fm.model as ModelSpec;

  // Parse inline hooks from frontmatter
  const hooks = fm.hooks ? parseInlineHooks(fm.hooks as Record<string, unknown>) : undefined;

  return {
    metadata: extractMetadata(fm),
    invocation: Object.keys(invocation).length > 0 ? invocation : undefined,
    tools: extractToolAccess(fm),
    context: Object.keys(context).length > 0 ? context : undefined,
    resources: fm.resources as string[] | undefined,
    instructions: body,
    hooks,
  };
}

// ---------------------------------------------------------------------------
// Agent Parser
// ---------------------------------------------------------------------------

export function parseAgent(component: ParsedComponent): AgentDefinition {
  const { frontmatter: fm, body } = component;

  // Parse MCP servers (can be string names or objects)
  let mcpServers: (string | McpServerRef)[] | undefined;
  if (fm.mcpServers && Array.isArray(fm.mcpServers)) {
    mcpServers = (fm.mcpServers as unknown[]).map((s) => {
      if (typeof s === "string") return s;
      return s as McpServerRef;
    });
  }

  const hooks = fm.hooks ? parseInlineHooks(fm.hooks as Record<string, unknown>) : undefined;

  return {
    metadata: extractMetadata(fm),
    model: fm.model as ModelSpec | undefined,
    maxTurns: fm.maxTurns as number | undefined,
    tools: extractToolAccess(fm),
    permissionMode: fm.permissionMode as PermissionMode | undefined,
    skills: fm.skills as string[] | undefined,
    mcpServers,
    memory: fm.memory as MemoryScope | undefined,
    instructions: body,
    hooks,
    toolGroups: fm.toolGroups as string[] | undefined,
    whenToUse: fm.whenToUse as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Hook Parser
// ---------------------------------------------------------------------------

export function parseHook(component: ParsedComponent): HookDefinition {
  const { frontmatter: fm, body } = component;

  const handlers: HookHandler[] = [];
  if (fm.handlers && Array.isArray(fm.handlers)) {
    for (const h of fm.handlers as Record<string, unknown>[]) {
      handlers.push({
        type: h.type as HookHandler["type"],
        command: h.command as string | undefined,
        prompt: h.prompt as string | undefined,
        model: h.model as ModelSpec | undefined,
        timeout: h.timeout as number | undefined,
        statusMessage: h.statusMessage as string | undefined,
        async: h.async as boolean | undefined,
        once: h.once as boolean | undefined,
      });
    }
  }

  let fallback: HookFallback | undefined;
  if (fm.fallback && typeof fm.fallback === "object") {
    const fb = fm.fallback as Record<string, unknown>;
    fallback = {
      strategy: fb.strategy as HookFallback["strategy"],
      description: fb.description as string | undefined,
    };
  }

  return {
    metadata: extractMetadata(fm),
    event: fm.event as HookEvent,
    matcher: fm.matcher as string | undefined,
    handlers,
    fallback,
    instructions: body || undefined,
  };
}

// ---------------------------------------------------------------------------
// Tool Parser
// ---------------------------------------------------------------------------

export function parseTool(component: ParsedComponent): ToolDefinition {
  const { frontmatter: fm, body } = component;

  const parameters = (fm.parameters || {
    type: "object",
    properties: {},
  }) as ToolParameters;

  const impl = fm.implementation as Record<string, unknown> | undefined;
  const implementation: ToolImplementation = impl
    ? {
        type: impl.type as ToolImplementation["type"],
        command: impl.command as string | undefined,
        script: impl.script as string | undefined,
        mcpProxy: impl.mcpProxy as ToolImplementation["mcpProxy"],
      }
    : { type: "command" };

  let exposure: ToolExposure | undefined;
  if (fm.exposure && typeof fm.exposure === "object") {
    const exp = fm.exposure as Record<string, unknown>;
    exposure = {
      mcp: exp.mcp as boolean | undefined,
      native: exp.native as boolean | undefined,
    };
  }

  return {
    metadata: extractMetadata(fm),
    parameters,
    implementation,
    exposure,
    instructions: body || undefined,
  };
}

// ---------------------------------------------------------------------------
// Policy Parser
// ---------------------------------------------------------------------------

export function parsePolicy(component: ParsedComponent): PolicyDefinition {
  const { frontmatter: fm, body } = component;

  let permissions: PermissionRules | undefined;
  if (fm.permissions && typeof fm.permissions === "object") {
    const p = fm.permissions as Record<string, unknown>;
    permissions = {
      deny: p.deny as string[] | undefined,
      ask: p.ask as string[] | undefined,
      allow: p.allow as string[] | undefined,
    };
  }

  let sandbox: SandboxConfig | undefined;
  if (fm.sandbox && typeof fm.sandbox === "object") {
    const s = fm.sandbox as Record<string, unknown>;
    sandbox = {
      enabled: s.enabled as boolean | undefined,
      excludedCommands: s.excludedCommands as string[] | undefined,
      network: s.network as SandboxConfig["network"],
    };
  }

  return {
    metadata: extractMetadata(fm),
    permissions,
    sandbox,
    instructions: body || undefined,
  };
}

// ---------------------------------------------------------------------------
// Inline Hook Parser (for hooks embedded in skill/agent frontmatter)
// ---------------------------------------------------------------------------

function parseInlineHooks(
  hooksData: Record<string, unknown>
): HookDefinition[] {
  const hooks: HookDefinition[] = [];

  for (const [eventName, eventConfig] of Object.entries(hooksData)) {
    if (!Array.isArray(eventConfig)) continue;

    for (const hookEntry of eventConfig as Record<string, unknown>[]) {
      const handlers: HookHandler[] = [];

      if (hookEntry.hooks && Array.isArray(hookEntry.hooks)) {
        for (const h of hookEntry.hooks as Record<string, unknown>[]) {
          handlers.push({
            type: h.type as HookHandler["type"],
            command: h.command as string | undefined,
            prompt: h.prompt as string | undefined,
            model: h.model as ModelSpec | undefined,
            timeout: h.timeout as number | undefined,
            statusMessage: h.statusMessage as string | undefined,
            async: h.async as boolean | undefined,
            once: h.once as boolean | undefined,
          });
        }
      }

      hooks.push({
        metadata: {
          name: `${eventName}-${hookEntry.matcher || "all"}`.toLowerCase(),
          description: `Inline hook for ${eventName}`,
        },
        event: eventName as HookEvent,
        matcher: hookEntry.matcher as string | undefined,
        handlers,
      });
    }
  }

  return hooks;
}
