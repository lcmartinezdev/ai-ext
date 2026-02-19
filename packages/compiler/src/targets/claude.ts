/**
 * @ai-ext/compiler — Claude Code Target
 *
 * Generates:
 *   .claude/settings.json             ← from policies + hooks
 *   .claude/skills/<name>/SKILL.md   ← from skills
 *   .claude/agents/<name>.md         ← from agents
 *   .claude/rules/<name>.md          ← from rules
 *   .claude/rules/_ai-ext-index.md   ← index with @imports for all rules
 *   .mcp.json                        ← from tools (MCP exposure) + runtime bridge
 */

import type { CompilationTarget, TargetOutput } from "./target.js";
import type {
  ExtensionIR,
  SkillDefinition,
  AgentDefinition,
  HookDefinition,
  ToolDefinition,
  PolicyDefinition,
  BuildWarning,
  RuntimeRequirement,
  HookHandler,
} from "@ai-ext/schema";

export class ClaudeTarget implements CompilationTarget {
  readonly name = "claude" as const;
  readonly displayName = "Claude Code";

  compile(ir: ExtensionIR): TargetOutput {
    const files = new Map<string, string>();
    const warnings: BuildWarning[] = [];
    const runtimeRequirements: RuntimeRequirement[] = [];

    // 1. Emit skills → .claude/skills/<name>/SKILL.md
    for (const skill of ir.skills) {
      const path = `.claude/skills/${skill.metadata.name}/SKILL.md`;
      files.set(path, this.emitSkill(skill));
    }

    // 2. Emit agents → .claude/agents/<name>.md
    for (const agent of ir.agents) {
      const path = `.claude/agents/${agent.metadata.name}.md`;
      files.set(path, this.emitAgent(agent));
    }

    // 3. Emit rules → .claude/rules/<name>.md
    //    Rules go into .claude/rules/ which Claude Code auto-loads.
    //    We do NOT generate a root CLAUDE.md — the project may already have one.
    //    Instead, we generate a .claude/rules/_ai-ext.md that uses @imports
    //    so the user can reference it from their own CLAUDE.md if desired.
    const ruleNames: string[] = [];
    for (const [name, content] of ir.rules) {
      files.set(`.claude/rules/${name}`, content);
      ruleNames.push(name);
    }
    if (ruleNames.length > 0) {
      const importLines = ruleNames
        .map((name) => `@.claude/rules/${name}`)
        .join("\n");
      files.set(
        ".claude/rules/_ai-ext-index.md",
        `# ${ir.manifest.name}\n\n${ir.manifest.description}\n\n${importLines}\n`
      );
    }

    // 4. Emit hooks → .claude/settings.json (hooks section)
    const hooksConfig = this.emitHooks(ir.hooks, warnings);

    // 5. Emit policies → .claude/settings.json (permissions section)
    const permissionsConfig = this.emitPolicies(ir.policies);

    // 6. Build settings.json
    const settings: Record<string, unknown> = {};
    if (Object.keys(hooksConfig).length > 0) {
      settings.hooks = hooksConfig;
    }
    if (Object.keys(permissionsConfig).length > 0) {
      settings.permissions = permissionsConfig;
    }
    if (Object.keys(settings).length > 0) {
      files.set(".claude/settings.json", JSON.stringify(settings, null, 2));
    }

    // 7. Emit tools → .mcp.json (if any tools need MCP exposure)
    const mcpConfig = this.emitTools(ir.tools, runtimeRequirements);
    if (mcpConfig) {
      files.set(".mcp.json", JSON.stringify(mcpConfig, null, 2));
    }

    return { files, warnings, runtimeRequirements };
  }

  // -------------------------------------------------------------------------
  // Skill Emitter
  // -------------------------------------------------------------------------

  private emitSkill(skill: SkillDefinition): string {
    const fm: Record<string, unknown> = {
      name: skill.metadata.name,
      description: skill.metadata.description,
    };

    // Map invocation settings
    if (skill.invocation) {
      if (skill.invocation.argumentHint) {
        fm["argument-hint"] = skill.invocation.argumentHint;
      }
      if (skill.invocation.modelInvocable === false) {
        fm["disable-model-invocation"] = true;
      }
      if (skill.invocation.userInvocable === false) {
        fm["user-invocable"] = false;
      }
    }

    // Map tool access
    if (skill.tools?.allowed) {
      fm["allowed-tools"] = skill.tools.allowed.join(", ");
    }

    // Map context
    if (skill.context?.mode) {
      fm.context = skill.context.mode;
    }
    if (skill.context?.agent) {
      fm.agent = skill.context.agent;
    }
    if (skill.context?.model) {
      fm.model = skill.context.model;
    }

    // Map inline hooks
    if (skill.hooks && skill.hooks.length > 0) {
      fm.hooks = this.buildInlineHooks(skill.hooks);
    }

    return this.renderMarkdownWithFrontmatter(fm, skill.instructions);
  }

  // -------------------------------------------------------------------------
  // Agent Emitter
  // -------------------------------------------------------------------------

  private emitAgent(agent: AgentDefinition): string {
    const fm: Record<string, unknown> = {
      name: agent.metadata.name,
      description: agent.metadata.description,
    };

    if (agent.model) fm.model = agent.model;
    if (agent.maxTurns) fm.maxTurns = agent.maxTurns;
    if (agent.permissionMode) fm.permissionMode = agent.permissionMode;
    if (agent.memory) fm.memory = agent.memory;
    if (agent.skills) fm.skills = agent.skills;

    // Map tool access
    if (agent.tools?.allowed) {
      fm.tools = agent.tools.allowed.join(", ");
    }
    if (agent.tools?.disallowed) {
      fm.disallowedTools = agent.tools.disallowed.join(", ");
    }

    // Map MCP servers
    if (agent.mcpServers) {
      fm.mcpServers = agent.mcpServers;
    }

    // Map inline hooks
    if (agent.hooks && agent.hooks.length > 0) {
      fm.hooks = this.buildInlineHooks(agent.hooks);
    }

    return this.renderMarkdownWithFrontmatter(fm, agent.instructions);
  }

  // -------------------------------------------------------------------------
  // Hook Emitter
  // -------------------------------------------------------------------------

  private emitHooks(
    hooks: HookDefinition[],
    warnings: BuildWarning[]
  ): Record<string, unknown> {
    if (hooks.length === 0) return {};

    const hooksConfig: Record<string, unknown[]> = {};

    for (const hook of hooks) {
      if (!hooksConfig[hook.event]) {
        hooksConfig[hook.event] = [];
      }

      const entry: Record<string, unknown> = {};
      if (hook.matcher) {
        entry.matcher = hook.matcher;
      }

      entry.hooks = hook.handlers.map((h) => {
        const handler: Record<string, unknown> = { type: h.type };
        if (h.command) handler.command = h.command;
        if (h.prompt) handler.prompt = h.prompt;
        if (h.model) handler.model = h.model;
        if (h.timeout) handler.timeout = h.timeout;
        if (h.statusMessage) handler.statusMessage = h.statusMessage;
        if (h.async) handler.async = h.async;
        if (h.once) handler.once = h.once;
        return handler;
      });

      hooksConfig[hook.event].push(entry);
    }

    return hooksConfig;
  }

  // -------------------------------------------------------------------------
  // Policy Emitter
  // -------------------------------------------------------------------------

  private emitPolicies(policies: PolicyDefinition[]): Record<string, unknown> {
    if (policies.length === 0) return {};

    // Merge all policies into a single permissions block
    const allow: string[] = [];
    const deny: string[] = [];
    const ask: string[] = [];

    for (const policy of policies) {
      if (policy.permissions) {
        if (policy.permissions.allow) allow.push(...policy.permissions.allow);
        if (policy.permissions.deny) deny.push(...policy.permissions.deny);
        if (policy.permissions.ask) ask.push(...policy.permissions.ask);
      }
    }

    const result: Record<string, unknown> = {};
    if (allow.length > 0) result.allow = allow;
    if (deny.length > 0) result.deny = deny;
    if (ask.length > 0) result.ask = ask;

    return result;
  }

  // -------------------------------------------------------------------------
  // Tool Emitter → .mcp.json
  // -------------------------------------------------------------------------

  private emitTools(
    tools: ToolDefinition[],
    runtimeReqs: RuntimeRequirement[]
  ): Record<string, unknown> | null {
    const mcpTools = tools.filter(
      (t) => t.exposure?.mcp !== false // Default to MCP exposure
    );

    if (mcpTools.length === 0) return null;

    // If there are tools to expose, the runtime MCP server is required
    runtimeReqs.push({
      feature: "tool-server",
      reason: `${mcpTools.length} tool(s) require MCP server exposure`,
      component: "tools",
    });

    return {
      mcpServers: {
        "ai-ext-runtime": {
          command: "ai-ext",
          args: ["serve"],
          env: {},
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private buildInlineHooks(
    hooks: HookDefinition[]
  ): Record<string, unknown[]> {
    const result: Record<string, unknown[]> = {};

    for (const hook of hooks) {
      if (!result[hook.event]) {
        result[hook.event] = [];
      }

      const entry: Record<string, unknown> = {};
      if (hook.matcher) entry.matcher = hook.matcher;
      entry.hooks = hook.handlers.map((h) => {
        const handler: Record<string, unknown> = { type: h.type };
        if (h.command) handler.command = h.command;
        if (h.prompt) handler.prompt = h.prompt;
        if (h.model) handler.model = h.model;
        if (h.timeout) handler.timeout = h.timeout;
        if (h.statusMessage) handler.statusMessage = h.statusMessage;
        if (h.async) handler.async = h.async;
        if (h.once) handler.once = h.once;
        return handler;
      });

      result[hook.event].push(entry);
    }

    return result;
  }

  private renderMarkdownWithFrontmatter(
    frontmatter: Record<string, unknown>,
    body: string
  ): string {
    const yaml = Object.entries(frontmatter)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => {
        if (typeof v === "string") return `${k}: ${v}`;
        if (typeof v === "boolean" || typeof v === "number") return `${k}: ${v}`;
        return `${k}: ${JSON.stringify(v)}`;
      })
      .join("\n");

    return `---\n${yaml}\n---\n\n${body}\n`;
  }
}
