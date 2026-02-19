/**
 * @ai-ext/compiler — KiloCode Target
 *
 * Generates:
 *   .kilocodemodes            ← from agents (mapped to Custom Modes)
 *   .kilocode/skills/<name>/SKILL.md  ← from skills
 *   .kilocode/rules/<name>.md ← from rules (auto-loaded by KiloCode)
 *   .kilocode/mcp.json        ← from tools (MCP exposure) + runtime bridge
 *
 * Key adaptations:
 *   - Agents → Custom Modes (slug, roleDefinition, groups)
 *   - Hooks → NOT SUPPORTED natively → runtime bridge via MCP
 *   - Permissions → Mode tool groups + file regex
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
} from "@ai-ext/schema";

// KiloCode mode definition
interface KiloMode {
  slug: string;
  name: string;
  description: string;
  roleDefinition: string;
  whenToUse?: string;
  customInstructions?: string;
  groups: (string | [string, { fileRegex?: string; description?: string }])[];
}

export class KiloCodeTarget implements CompilationTarget {
  readonly name = "kilocode" as const;
  readonly displayName = "KiloCode";

  compile(ir: ExtensionIR): TargetOutput {
    const files = new Map<string, string>();
    const warnings: BuildWarning[] = [];
    const runtimeRequirements: RuntimeRequirement[] = [];

    // 1. Emit skills → .kilocode/skills/<name>/SKILL.md
    //    Skills and workflows are distinct concepts in KiloCode:
    //    - Skills (.kilocode/skills/) are on-demand behavioral contracts loaded by the LLM
    //    - Workflows (.kilocode/workflows/) are step-by-step procedures invoked via /slash-command
    //    We only emit skills here. Workflows would require a separate canonical component.
    for (const skill of ir.skills) {
      const path = `.kilocode/skills/${skill.metadata.name}/SKILL.md`;
      files.set(path, this.emitSkill(skill));
    }

    // 2. Emit agents → .kilocodemodes (Custom Modes YAML)
    if (ir.agents.length > 0) {
      const modes = ir.agents.map((a) => this.agentToMode(a, warnings));
      files.set(".kilocodemodes", this.emitModes(modes));
    }

    // 3. Emit rules → .kilocode/rules/<name>.md
    //    Rules go into .kilocode/rules/ which KiloCode auto-loads.
    //    We do NOT generate a root AGENTS.md — the project may already have one.
    for (const [name, content] of ir.rules) {
      files.set(`.kilocode/rules/${name}`, content);
    }

    // 4. Hooks → KiloCode has NO native hook support
    if (ir.hooks.length > 0) {
      warnings.push({
        component: "hooks",
        message:
          "KiloCode does not support hooks natively. Hooks with fallback strategy 'mcp-tool' will be bridged via the ai-ext runtime MCP server. Hooks with 'skill-injection' will be added as skill instructions. Hooks with 'ignore' will be skipped.",
        severity: "warn",
      });

      runtimeRequirements.push({
        feature: "hook-engine",
        reason: `${ir.hooks.length} hook(s) require runtime emulation (KiloCode has no native hook support)`,
        component: "hooks",
      });
    }

    // 5. Emit policies → .kilocode/rules/ (as instruction text)
    for (const policy of ir.policies) {
      if (policy.instructions) {
        files.set(
          `.kilocode/rules/policy-${policy.metadata.name}.md`,
          this.emitPolicyAsRules(policy)
        );
      }
      // Note: KiloCode doesn't have a granular permissions config like Claude Code.
      // Permissions are enforced via mode tool groups, which is done in agentToMode.
      if (policy.permissions) {
        warnings.push({
          component: `policy:${policy.metadata.name}`,
          message:
            "KiloCode does not support granular permission patterns. Policies are emitted as rule instructions. Tool restrictions are mapped to mode groups where possible.",
          severity: "warn",
        });
      }
    }

    // 6. Emit tools → .kilocode/mcp.json
    const mcpConfig = this.emitTools(ir.tools, runtimeRequirements);
    if (mcpConfig) {
      files.set(".kilocode/mcp.json", JSON.stringify(mcpConfig, null, 2));
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

    // Emit license if present
    if (skill.metadata.license) fm.license = skill.metadata.license;

    // Emit compatibility if present
    if (skill.metadata.compatibility) fm.compatibility = skill.metadata.compatibility;

    // Emit metadata if present
    if (skill.metadata.metadata) fm.metadata = skill.metadata.metadata;

    // Emit tags if present
    if (skill.metadata.tags) fm.tags = skill.metadata.tags;

    // Emit allowed-tools (space-delimited per Agent Skills spec)
    if (skill.tools?.allowed) {
      fm["allowed-tools"] = skill.tools.allowed.join(" ");
    }

    // Emit invocation fields
    if (skill.invocation) {
      if (skill.invocation.argumentHint) {
        // Quote the argument-hint value since it may contain special chars like []
        fm["argument-hint"] = skill.invocation.argumentHint;
      }
      if (skill.invocation.userInvocable !== undefined) {
        fm["user-invocable"] = skill.invocation.userInvocable;
      }
      // Emit disable-model-invocation (inverted from modelInvocable)
      if (skill.invocation.modelInvocable !== undefined) {
        fm["disable-model-invocation"] = !skill.invocation.modelInvocable;
      }
    }

    // Emit context fields (mode, agent, model)
    if (skill.context) {
      if (skill.context.mode) fm.context = skill.context.mode;
      if (skill.context.agent) fm.agent = skill.context.agent;
      if (skill.context.model) fm.model = skill.context.model;
    }

    // Emit resources if present
    if (skill.resources) fm.resources = skill.resources;

    return this.renderMarkdownWithFrontmatter(fm, skill.instructions);
  }

  // -------------------------------------------------------------------------
  // Agent → Mode Mapping
  // -------------------------------------------------------------------------

  private agentToMode(
    agent: AgentDefinition,
    warnings: BuildWarning[]
  ): KiloMode {
    // Map tool access to KiloCode groups
    const groups = this.mapToolGroups(agent);

    // Map hooks warning
    if (agent.hooks && agent.hooks.length > 0) {
      warnings.push({
        component: `agent:${agent.metadata.name}`,
        message: `Agent-scoped hooks are not supported in KiloCode. ${agent.hooks.length} hook(s) will require runtime bridge.`,
        severity: "warn",
      });
    }

    return {
      slug: agent.metadata.name,
      name: agent.metadata.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      description: agent.metadata.description,
      roleDefinition: agent.instructions,
      whenToUse: agent.whenToUse,
      groups,
    };
  }

  private mapToolGroups(
    agent: AgentDefinition
  ): (string | [string, { fileRegex?: string; description?: string }])[] {
    // Default: all groups
    const allGroups = ["read", "edit", "browser", "command", "mcp"];

    if (!agent.tools?.allowed && !agent.tools?.disallowed) {
      return allGroups;
    }

    const groups: (
      | string
      | [string, { fileRegex?: string; description?: string }]
    )[] = [];

    // Map canonical tool names to KiloCode groups
    const allowed = new Set(agent.tools?.allowed || []);
    const disallowed = new Set(agent.tools?.disallowed || []);

    // Read tools → "read" group
    const readTools = ["Read", "Grep", "Glob"];
    if (readTools.some((t) => allowed.has(t)) || !readTools.some((t) => disallowed.has(t))) {
      groups.push("read");
    }

    // Edit tools → "edit" group
    const editTools = ["Edit", "Write"];
    if (editTools.some((t) => allowed.has(t)) && !editTools.some((t) => disallowed.has(t))) {
      groups.push("edit");
    }

    // Bash → "command" group
    if (allowed.has("Bash") || (!disallowed.has("Bash") && allowed.size === 0)) {
      groups.push("command");
    }

    // MCP tools
    groups.push("mcp");

    return groups;
  }

  private emitModes(modes: KiloMode[]): string {
    // KiloCode .kilocodemodes uses YAML format
    const lines: string[] = ["customModes:"];

    for (const mode of modes) {
      lines.push(`  - slug: ${mode.slug}`);
      lines.push(`    name: "${mode.name}"`);
      lines.push(`    description: "${mode.description}"`);
      lines.push(`    roleDefinition: |`);
      for (const line of mode.roleDefinition.split("\n")) {
        lines.push(`      ${line}`);
      }
      if (mode.whenToUse) {
        lines.push(`    whenToUse: "${mode.whenToUse}"`);
      }
      lines.push(`    groups:`);
      for (const group of mode.groups) {
        if (typeof group === "string") {
          lines.push(`      - ${group}`);
        } else {
          lines.push(`      - - ${group[0]}`);
          if (group[1].fileRegex) {
            lines.push(`        - fileRegex: "${group[1].fileRegex}"`);
          }
          if (group[1].description) {
            lines.push(`          description: "${group[1].description}"`);
          }
        }
      }
    }

    return lines.join("\n") + "\n";
  }

  // -------------------------------------------------------------------------
  // Policy Emitter
  // -------------------------------------------------------------------------

  private emitPolicyAsRules(policy: PolicyDefinition): string {
    const parts: string[] = [`# Policy: ${policy.metadata.name}\n`];

    if (policy.instructions) {
      parts.push(policy.instructions);
    }

    if (policy.permissions) {
      parts.push("\n## Permission Rules\n");
      if (policy.permissions.deny?.length) {
        parts.push("### NEVER do the following:");
        for (const p of policy.permissions.deny) {
          parts.push(`- ${p}`);
        }
      }
      if (policy.permissions.ask?.length) {
        parts.push("\n### Always ask before:");
        for (const p of policy.permissions.ask) {
          parts.push(`- ${p}`);
        }
      }
      if (policy.permissions.allow?.length) {
        parts.push("\n### Pre-approved actions:");
        for (const p of policy.permissions.allow) {
          parts.push(`- ${p}`);
        }
      }
    }

    return parts.join("\n") + "\n";
  }

  // -------------------------------------------------------------------------
  // Tool Emitter → .kilocode/mcp.json
  // -------------------------------------------------------------------------

  private emitTools(
    tools: ToolDefinition[],
    runtimeReqs: RuntimeRequirement[]
  ): Record<string, unknown> | null {
    const mcpTools = tools.filter((t) => t.exposure?.mcp !== false);
    if (mcpTools.length === 0) return null;

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

  private renderMarkdownWithFrontmatter(
    frontmatter: Record<string, unknown>,
    body: string
  ): string {
    const yaml = Object.entries(frontmatter)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => {
        if (typeof v === "string") {
          // Quote strings that contain special YAML characters or could be misinterpreted
          // (e.g., arrays like [foo], booleans like true/false, numbers)
          const needsQuoting =
            /^[\[\]{}|>&*!%@`$]/.test(v) || // starts with special char
            /\s$/.test(v) || // ends with whitespace
            v === "true" ||
            v === "false" ||
            v === "yes" ||
            v === "no" ||
            v === "null" ||
            v === "~" ||
            /^\d+(\.\d+)?$/.test(v); // looks like a number
          return `${k}: ${needsQuoting ? `"${v}"` : v}`;
        }
        if (typeof v === "boolean" || typeof v === "number") return `${k}: ${v}`;
        return `${k}: ${JSON.stringify(v)}`;
      })
      .join("\n");

    return `---\n${yaml}\n---\n\n${body}\n`;
  }
}
