/**
 * @ai-ext/compiler — OpenCode Target
 *
 * Generates:
 *   .opencode/skills/<name>/SKILL.md  ← from skills
 *   .opencode/agents/<name>.md        ← from agents
 *   .opencode/rules/<name>.md         ← from rules (referenced via opencode.json instructions)
 *   .opencode/plugins/ai-ext-hooks.ts ← from hooks (plugin-based hook binding)
 *   .opencode/tools/<name>.ts         ← from tools (native tool definitions)
 *   opencode.json                     ← from tools (MCP), hooks (plugins), rules (instructions)
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

export class OpenCodeTarget implements CompilationTarget {
  readonly name = "opencode" as const;
  readonly displayName = "OpenCode";

  compile(ir: ExtensionIR): TargetOutput {
    const files = new Map<string, string>();
    const warnings: BuildWarning[] = [];
    const runtimeRequirements: RuntimeRequirement[] = [];

    // 1. Emit skills → .opencode/skills/<name>/SKILL.md
    //    Skills and commands are distinct concepts in OpenCode:
    //    - Skills (.opencode/skills/) are on-demand behavioral contracts loaded by the LLM
    //    - Commands (.opencode/commands/) are prompt templates invoked via /slash-command
    //    We only emit skills here. Commands would require a separate canonical component.
    for (const skill of ir.skills) {
      const path = `.opencode/skills/${skill.metadata.name}/SKILL.md`;
      files.set(path, this.emitSkill(skill));
    }

    // 2. Emit agents → .opencode/agents/<name>.md
    for (const agent of ir.agents) {
      const path = `.opencode/agents/${agent.metadata.name}.md`;
      files.set(path, this.emitAgent(agent));
    }

    // 3. Emit rules → .opencode/rules/<name>.md
    //    We do NOT generate a root AGENTS.md — the project may already have one.
    //    Rules go into .opencode/rules/ and are referenced via the
    //    "instructions" field in opencode.json.
    const ruleNames: string[] = [];
    for (const [name, content] of ir.rules) {
      files.set(`.opencode/rules/${name}`, content);
      ruleNames.push(name);
    }

    // 4. Emit hooks → .opencode/plugins/ai-ext-hooks.ts
    if (ir.hooks.length > 0) {
      files.set(
        ".opencode/plugins/ai-ext-hooks.ts",
        this.emitHooksPlugin(ir.hooks)
      );
    }

    // 5. Emit tools → .opencode/tools/<name>.ts (native) + opencode.json MCP section
    const nativeTools = ir.tools.filter((t) => t.exposure?.native !== false);
    for (const tool of nativeTools) {
      const path = `.opencode/tools/${tool.metadata.name}.ts`;
      files.set(path, this.emitNativeTool(tool));
    }

    // 6. Build opencode.json (with instructions referencing rule files)
    const config = this.buildConfig(ir, runtimeRequirements, ruleNames);
    files.set("opencode.json", JSON.stringify(config, null, 2));

    // 7. Emit policies as rule files
    for (const policy of ir.policies) {
      if (policy.permissions) {
        // OpenCode supports per-agent permissions, but not a global permissions block
        // like Claude Code. Emit as instructions.
        warnings.push({
          component: `policy:${policy.metadata.name}`,
          message:
            "OpenCode uses per-agent permission globs rather than a global permissions block. Policy rules are emitted as agent instructions.",
          severity: "info",
        });
      }
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

    if (skill.metadata.license) fm.license = skill.metadata.license;
    if (skill.metadata.compatibility) fm.compatibility = skill.metadata.compatibility;
    if (skill.metadata.metadata) fm.metadata = skill.metadata.metadata;
    if (skill.tools?.allowed) {
      fm["allowed-tools"] = skill.tools.allowed.join(" ");
    }

    return this.renderMarkdownWithFrontmatter(fm, skill.instructions);
  }

  // -------------------------------------------------------------------------
  // Agent Emitter
  // -------------------------------------------------------------------------

  private emitAgent(agent: AgentDefinition): string {
    const fm: Record<string, unknown> = {
      description: agent.metadata.description,
    };

    if (agent.model) fm.model = agent.model;
    if (agent.maxTurns) fm.steps = agent.maxTurns; // OpenCode uses "steps"

    // OpenCode permission format
    if (agent.tools?.allowed || agent.tools?.disallowed) {
      const permission: Record<string, unknown> = {};
      if (agent.tools.allowed) {
        for (const tool of agent.tools.allowed) {
          permission[tool] = "allow";
        }
      }
      if (agent.tools.disallowed) {
        for (const tool of agent.tools.disallowed) {
          permission[tool] = "deny";
        }
      }
      fm.permission = permission;
    }

    // Tools as list
    if (agent.tools?.allowed) {
      fm.tools = agent.tools.allowed;
    }

    return this.renderMarkdownWithFrontmatter(fm, agent.instructions);
  }

  // -------------------------------------------------------------------------
  // Hooks → OpenCode Plugin
  // -------------------------------------------------------------------------

  private emitHooksPlugin(hooks: HookDefinition[]): string {
    // Map canonical events to OpenCode plugin hook points
    const lines: string[] = [
      `import type { Plugin } from "@opencode-ai/plugin";`,
      ``,
      `/**`,
      ` * ai-ext hooks plugin — auto-generated by ai-ext compiler`,
      ` * DO NOT EDIT MANUALLY`,
      ` */`,
      `export default function aiExtHooks(): Plugin {`,
      `  return {`,
    ];

    // Group hooks by their mapping to OpenCode events
    const toolBefore = hooks.filter((h) => h.event === "PreToolUse");
    const toolAfter = hooks.filter((h) => h.event === "PostToolUse");

    if (toolBefore.length > 0 || toolAfter.length > 0) {
      lines.push(`    tool: {`);

      if (toolBefore.length > 0) {
        lines.push(`      execute: {`);
        lines.push(`        async before({ tool, input }) {`);
        for (const hook of toolBefore) {
          if (hook.matcher) {
            lines.push(`          if (/${hook.matcher}/.test(tool)) {`);
          }
          for (const handler of hook.handlers) {
            if (handler.type === "command" && handler.command) {
              lines.push(
                `            const proc = Bun.spawn(${JSON.stringify(handler.command.split(" "))}, { stdin: "pipe" });`
              );
              lines.push(
                `            proc.stdin.write(JSON.stringify({ tool, input }));`
              );
              lines.push(`            proc.stdin.end();`);
              lines.push(`            await proc.exited;`);
            }
          }
          if (hook.matcher) {
            lines.push(`          }`);
          }
        }
        lines.push(`        },`);
        lines.push(`      },`);
      }

      if (toolAfter.length > 0) {
        lines.push(`      execute: {`);
        lines.push(`        async after({ tool, output }) {`);
        for (const hook of toolAfter) {
          if (hook.matcher) {
            lines.push(`          if (/${hook.matcher}/.test(tool)) {`);
          }
          for (const handler of hook.handlers) {
            if (handler.type === "command" && handler.command) {
              lines.push(
                `            const proc = Bun.spawn(${JSON.stringify(handler.command.split(" "))}, { stdin: "pipe" });`
              );
              lines.push(
                `            proc.stdin.write(JSON.stringify({ tool, output }));`
              );
              lines.push(`            proc.stdin.end();`);
              lines.push(`            await proc.exited;`);
            }
          }
          if (hook.matcher) {
            lines.push(`          }`);
          }
        }
        lines.push(`        },`);
        lines.push(`      },`);
      }

      lines.push(`    },`);
    }

    lines.push(`  };`);
    lines.push(`}`);

    return lines.join("\n") + "\n";
  }

  // -------------------------------------------------------------------------
  // Native Tool Emitter → .opencode/tools/<name>.ts
  // -------------------------------------------------------------------------

  private emitNativeTool(tool: ToolDefinition): string {
    const lines: string[] = [
      `import { tool } from "@opencode-ai/plugin";`,
      `import { z } from "zod";`,
      ``,
      `/**`,
      ` * ${tool.metadata.description}`,
      ` * Auto-generated by ai-ext compiler — DO NOT EDIT MANUALLY`,
      ` */`,
      `export default tool({`,
      `  description: ${JSON.stringify(tool.metadata.description)},`,
      `  schema: z.object({`,
    ];

    // Convert JSON Schema-style params to Zod
    if (tool.parameters?.properties) {
      for (const [name, prop] of Object.entries(tool.parameters.properties)) {
        const zodType = this.jsonSchemaTypeToZod(prop.type);
        const isRequired = tool.parameters.required?.includes(name);
        const desc = prop.description ? `.describe(${JSON.stringify(prop.description)})` : "";
        const optional = isRequired ? "" : ".optional()";
        lines.push(`    ${name}: z.${zodType}()${desc}${optional},`);
      }
    }

    lines.push(`  }),`);
    lines.push(`  async execute({ input, context }) {`);

    if (tool.implementation.type === "command" && tool.implementation.command) {
      // Template the command with input params
      lines.push(
        `    const cmd = ${JSON.stringify(tool.implementation.command)};`
      );
      lines.push(
        `    const result = await Bun.spawn(["sh", "-c", cmd], { env: { ...process.env, ...input } });`
      );
      lines.push(`    return await new Response(result.stdout).text();`);
    } else {
      lines.push(`    // TODO: Implement tool logic`);
      lines.push(`    return "not implemented";`);
    }

    lines.push(`  },`);
    lines.push(`});`);

    return lines.join("\n") + "\n";
  }

  private jsonSchemaTypeToZod(type: string): string {
    switch (type) {
      case "string":
        return "string";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      case "array":
        return "array(z.string())";
      default:
        return "unknown";
    }
  }

  // -------------------------------------------------------------------------
  // Config Builder → opencode.json
  // -------------------------------------------------------------------------

  private buildConfig(
    ir: ExtensionIR,
    runtimeReqs: RuntimeRequirement[],
    ruleNames: string[]
  ): Record<string, unknown> {
    const config: Record<string, unknown> = {
      $schema: "https://opencode.ai/config.json",
    };

    // Instructions: reference rule files in .opencode/rules/
    if (ruleNames.length > 0) {
      config.instructions = ruleNames.map((name) => `.opencode/rules/${name}`);
    }

    // MCP servers for tools
    const mcpTools = ir.tools.filter((t) => t.exposure?.mcp !== false);
    if (mcpTools.length > 0) {
      runtimeReqs.push({
        feature: "tool-server",
        reason: `${mcpTools.length} tool(s) require MCP server exposure`,
        component: "tools",
      });

      config.mcp = {
        "ai-ext-runtime": {
          type: "local",
          command: ["ai-ext", "serve"],
        },
      };
    }

    // Plugin references
    if (ir.hooks.length > 0) {
      config.plugin = ["./.opencode/plugins/ai-ext-hooks.ts"];
    }

    return config;
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
        if (typeof v === "string") return `${k}: ${v}`;
        if (typeof v === "boolean" || typeof v === "number") return `${k}: ${v}`;
        return `${k}: ${JSON.stringify(v)}`;
      })
      .join("\n");

    return `---\n${yaml}\n---\n\n${body}\n`;
  }
}
