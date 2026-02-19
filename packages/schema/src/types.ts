/**
 * @ai-ext/schema — Canonical DSL Type Definitions
 *
 * These types define the Universal AI Agent Extension Platform's
 * canonical format. All extensions are authored against these types.
 * The compiler transforms them into host-specific formats.
 *
 * Design principle: Extend the Agent Skills spec (SKILL.md + YAML frontmatter)
 * rather than inventing a new format. Markdown files with extended YAML
 * frontmatter are the canonical source.
 */

// ---------------------------------------------------------------------------
// Common / Shared Types
// ---------------------------------------------------------------------------

/** Metadata common to all extension components */
export interface ComponentMetadata {
  /** Unique name (lowercase, hyphens, max 64 chars) */
  name: string;
  /** Human-readable description (max 1024 chars) */
  description: string;
  /** SPDX license identifier */
  license?: string;
  /** Compatibility notes */
  compatibility?: string;
  /** Arbitrary key-value metadata */
  metadata?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
}

/** Tool permission pattern (e.g., "Bash(npm run *)", "Read(.env)") */
export type PermissionPattern = string;

/** Tool access control */
export interface ToolAccess {
  /** Tools explicitly allowed */
  allowed?: string[];
  /** Tools explicitly denied */
  disallowed?: string[];
}

/** Permission mode for agents */
export type PermissionMode =
  | "default"
  | "acceptEdits"
  | "dontAsk"
  | "plan"
  | "delegate"
  | "bypassPermissions";

/** Memory scope */
export type MemoryScope = "user" | "project" | "local" | "session";

/** Model specification */
export type ModelSpec = "default" | "sonnet" | "opus" | "haiku" | "inherit" | string;

/** Supported target hosts */
export type TargetHost = "claude" | "kilocode" | "opencode";

// ---------------------------------------------------------------------------
// Extension Manifest
// ---------------------------------------------------------------------------

/** Top-level extension.yaml manifest */
export interface ExtensionManifest {
  /** Extension name */
  name: string;
  /** Semantic version */
  version: string;
  /** Description */
  description: string;
  /** Author name or org */
  author?: string;
  /** SPDX license */
  license?: string;

  /** Glob or directory path to skills */
  skills?: string;
  /** Glob or directory path to agents */
  agents?: string;
  /** Glob or directory path to hooks */
  hooks?: string;
  /** Glob or directory path to tools */
  tools?: string;
  /** Glob or directory path to policies */
  policies?: string;
  /** Glob or directory path to rules */
  rules?: string;
}

// ---------------------------------------------------------------------------
// Skill Definition (extends Agent Skills spec)
// ---------------------------------------------------------------------------

/** Invocation control for a skill */
export interface SkillInvocation {
  /** Whether the user can invoke this skill via /command */
  userInvocable?: boolean;
  /** Whether the AI model can auto-invoke this skill */
  modelInvocable?: boolean;
  /** Hint shown in autocomplete (e.g., "[file-or-pr]") */
  argumentHint?: string;
}

/** Execution context for a skill */
export interface SkillContext {
  /** fork = isolated subagent, inline = same context */
  mode?: "fork" | "inline";
  /** Agent type when forked */
  agent?: string;
  /** Model override */
  model?: ModelSpec;
}

/** Canonical skill definition */
export interface SkillDefinition {
  /** Component metadata (from YAML frontmatter) */
  metadata: ComponentMetadata;
  /** Invocation control */
  invocation?: SkillInvocation;
  /** Tool access control */
  tools?: ToolAccess;
  /** Execution context */
  context?: SkillContext;
  /** Resource files bundled with the skill */
  resources?: string[];
  /** Skill instructions (markdown body) */
  instructions: string;
  /** Hooks scoped to this skill's activation */
  hooks?: HookDefinition[];
}

// ---------------------------------------------------------------------------
// Agent Definition
// ---------------------------------------------------------------------------

/** MCP server reference for an agent */
export interface McpServerRef {
  /** Server name (references a configured MCP server) */
  name: string;
  /** Inline server command (if not referencing existing config) */
  command?: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

/** Canonical agent definition */
export interface AgentDefinition {
  /** Component metadata (from YAML frontmatter) */
  metadata: ComponentMetadata;
  /** Model to use */
  model?: ModelSpec;
  /** Maximum agentic turns */
  maxTurns?: number;
  /** Tool access control */
  tools?: ToolAccess;
  /** Permission mode */
  permissionMode?: PermissionMode;
  /** Skills to preload into context */
  skills?: string[];
  /** MCP servers available to this agent */
  mcpServers?: (string | McpServerRef)[];
  /** Memory scope */
  memory?: MemoryScope;
  /** Agent instructions (markdown body) */
  instructions: string;
  /** Hooks scoped to this agent */
  hooks?: HookDefinition[];

  // KiloCode-specific mode mapping
  /** Tool groups for KiloCode mode mapping */
  toolGroups?: string[];
  /** When the orchestrator should delegate to this agent */
  whenToUse?: string;
}

// ---------------------------------------------------------------------------
// Hook Definition
// ---------------------------------------------------------------------------

/** Canonical hook event types (superset across all hosts) */
export type HookEvent =
  // Session lifecycle
  | "SessionStart"
  | "SessionEnd"
  // User interaction
  | "UserPromptSubmit"
  // Tool lifecycle
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "PermissionRequest"
  // Agent lifecycle
  | "SubagentStart"
  | "SubagentStop"
  // Notifications
  | "Notification"
  // Completion
  | "Stop"
  | "TaskCompleted"
  // Compaction
  | "PreCompact"
  // File events (OpenCode-specific, useful to canonicalize)
  | "FileEdited"
  | "FileWatcherUpdated";

/** Hook handler type */
export type HookHandlerType = "command" | "prompt" | "agent";

/** A single hook handler */
export interface HookHandler {
  /** Handler type */
  type: HookHandlerType;
  /** Shell command (for type: command) */
  command?: string;
  /** Prompt text (for type: prompt | agent) */
  prompt?: string;
  /** Model override (for type: prompt | agent) */
  model?: ModelSpec;
  /** Timeout in seconds */
  timeout?: number;
  /** Custom spinner/status message */
  statusMessage?: string;
  /** Run asynchronously (command only) */
  async?: boolean;
  /** Run only once per session (skill-scoped hooks) */
  once?: boolean;
}

/** Fallback strategy for hosts that don't support hooks */
export type HookFallbackStrategy =
  | "mcp-tool"          // Expose as MCP tool the agent should call
  | "skill-injection"   // Inject as skill instructions
  | "ignore";           // Skip on unsupported hosts

/** Fallback configuration */
export interface HookFallback {
  /** Strategy to use when host lacks hook support */
  strategy: HookFallbackStrategy;
  /** Description for the fallback behavior */
  description?: string;
}

/** Canonical hook definition */
export interface HookDefinition {
  /** Component metadata (from YAML frontmatter) */
  metadata: ComponentMetadata;
  /** Event that triggers this hook */
  event: HookEvent;
  /** Regex matcher to filter when the hook fires */
  matcher?: string;
  /** Handlers to execute */
  handlers: HookHandler[];
  /** Fallback for unsupported hosts */
  fallback?: HookFallback;
  /** Hook instructions (markdown body — describes purpose) */
  instructions?: string;
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

/** JSON Schema-like parameter definition */
export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

export interface ToolParameterProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  default?: unknown;
  items?: ToolParameterProperty;
  enum?: unknown[];
}

/** Tool implementation type */
export type ToolImplementationType = "command" | "script" | "mcp-proxy";

/** Tool implementation */
export interface ToolImplementation {
  /** How the tool runs */
  type: ToolImplementationType;
  /** Shell command (supports {{param}} template syntax) */
  command?: string;
  /** Script file path (relative to tool directory) */
  script?: string;
  /** MCP server + tool to proxy to */
  mcpProxy?: {
    server: string;
    tool: string;
  };
}

/** Tool exposure settings */
export interface ToolExposure {
  /** Expose via MCP server */
  mcp?: boolean;
  /** Register as native tool if host supports it */
  native?: boolean;
}

/** Canonical tool definition */
export interface ToolDefinition {
  /** Component metadata (from YAML frontmatter) */
  metadata: ComponentMetadata;
  /** Parameter schema */
  parameters: ToolParameters;
  /** How it executes */
  implementation: ToolImplementation;
  /** Exposure settings */
  exposure?: ToolExposure;
  /** Tool instructions (markdown body) */
  instructions?: string;
}

// ---------------------------------------------------------------------------
// Policy Definition
// ---------------------------------------------------------------------------

/** Permission rules */
export interface PermissionRules {
  /** Patterns to always deny */
  deny?: PermissionPattern[];
  /** Patterns that require user confirmation */
  ask?: PermissionPattern[];
  /** Patterns to always allow */
  allow?: PermissionPattern[];
}

/** Sandbox configuration */
export interface SandboxConfig {
  /** Enable OS-level sandboxing */
  enabled?: boolean;
  /** Commands excluded from sandbox */
  excludedCommands?: string[];
  /** Network restrictions */
  network?: {
    allowedDomains?: string[];
    allowUnixSockets?: string[];
    allowLocalBinding?: boolean;
  };
}

/** Canonical policy definition */
export interface PolicyDefinition {
  /** Component metadata (from YAML frontmatter) */
  metadata: ComponentMetadata;
  /** Permission rules */
  permissions?: PermissionRules;
  /** Sandbox configuration */
  sandbox?: SandboxConfig;
  /** Policy instructions (markdown body — human-readable rationale) */
  instructions?: string;
}

// ---------------------------------------------------------------------------
// Intermediate Representation (IR)
// ---------------------------------------------------------------------------

/**
 * The IR is the fully resolved, validated in-memory representation
 * of an extension. The compiler transforms this into host-specific output.
 */
export interface ExtensionIR {
  /** Resolved manifest */
  manifest: ExtensionManifest;
  /** All resolved skills */
  skills: SkillDefinition[];
  /** All resolved agents */
  agents: AgentDefinition[];
  /** All resolved hooks */
  hooks: HookDefinition[];
  /** All resolved tools */
  tools: ToolDefinition[];
  /** All resolved policies */
  policies: PolicyDefinition[];
  /** All rule files (path → content) */
  rules: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Compiler Types
// ---------------------------------------------------------------------------

/** Options for the build command */
export interface BuildOptions {
  /** Target host to compile for */
  target: TargetHost;
  /** Source directory (where extension.yaml lives) */
  sourceDir: string;
  /** Output directory (defaults to host standard dirs in sourceDir) */
  outDir?: string;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Dry run — show what would be generated without writing */
  dryRun?: boolean;
  /** Auto-fix YAML description issues */
  fixYamlDescriptions?: boolean;
}

/** Result of a compilation */
export interface BuildResult {
  /** Target that was compiled for */
  target: TargetHost;
  /** Files that were generated (relative path → content) */
  files: Map<string, string>;
  /** Warnings during compilation */
  warnings: BuildWarning[];
  /** Features that require runtime compensation */
  runtimeRequired: RuntimeRequirement[];
}

/** A compilation warning */
export interface BuildWarning {
  /** Component that triggered the warning */
  component: string;
  /** Warning message */
  message: string;
  /** Severity */
  severity: "info" | "warn" | "error";
}

/** A feature that requires the runtime layer */
export interface RuntimeRequirement {
  /** Feature name */
  feature: string;
  /** Why it's needed */
  reason: string;
  /** Which component needs it */
  component: string;
}
