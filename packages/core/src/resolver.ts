/**
 * @ai-ext/core — Extension Resolver
 *
 * Resolves an extension.yaml manifest into a fully populated ExtensionIR.
 * This is the main entry point for loading an extension:
 *
 *   extension.yaml → discover components → parse each → validate → IR
 */

import { resolve, basename, dirname } from "node:path";
import type {
  ExtensionIR,
  ExtensionManifest,
  SkillDefinition,
  AgentDefinition,
  HookDefinition,
  ToolDefinition,
  PolicyDefinition,
  ValidationResult,
} from "@ai-ext/schema";
import {
  validateManifest,
  validateSkill,
  validateAgent,
  validateHook,
  validateTool,
  validatePolicy,
} from "@ai-ext/schema";
import {
  loadManifest,
  discoverComponents,
  discoverRules,
  parseMarkdownFile,
} from "./loader.js";
import {
  parseSkill,
  parseAgent,
  parseHook,
  parseTool,
  parsePolicy,
} from "./parser.js";

// ---------------------------------------------------------------------------
// Resolution Result
// ---------------------------------------------------------------------------

export interface ResolveResult {
  /** The fully resolved IR */
  ir: ExtensionIR;
  /** Validation errors encountered during resolution */
  errors: ResolveError[];
  /** Whether the extension is valid (no errors, may have warnings) */
  valid: boolean;
}

export interface ResolveError {
  /** Which component had the error */
  component: string;
  /** File path */
  file: string;
  /** Error message */
  message: string;
  /** Severity */
  severity: "error" | "warning";
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve an extension directory into a fully populated IR.
 *
 * @param extensionDir - Directory containing extension.yaml
 * @param options - Resolution options
 * @returns Resolved IR with validation results
 */
export function resolveExtension(
  extensionDir: string,
  options?: { fixYamlDescriptions?: boolean }
): ResolveResult {
  const dir = resolve(extensionDir);
  const errors: ResolveError[] = [];
  const fixYaml = options?.fixYamlDescriptions ?? false;

  // 1. Load manifest
  const manifest = loadManifest(dir);
  const manifestValidation = validateManifest(manifest);
  collectErrors(errors, "manifest", "extension.yaml", manifestValidation);

  // 2. Discover and parse skills
  const skillFiles = discoverComponents(dir, manifest.skills, "SKILL.md");
  const skills: SkillDefinition[] = [];
  for (const file of skillFiles) {
    try {
      const parsed = parseMarkdownFile(file, { fixYamlDescriptions: fixYaml });
      const skill = parseSkill(parsed);

      // Validate name matches directory (KiloCode requirement)
      const skillDir = dirname(file);
      const skillNameFromPath = basename(skillDir);
      if (skillNameFromPath !== skill.metadata.name) {
        errors.push({
          component: "skill",
          file,
          message: `Skill name "${skill.metadata.name}" does not match directory name "${skillNameFromPath}". In KiloCode, the name field must match the parent directory name.`,
          severity: "warning",
        });
      }

      const validation = validateSkill({
        ...skill.metadata,
        invocation: skill.invocation,
        context: skill.context,
        tools: skill.tools,
      });
      collectErrors(errors, `skill:${skill.metadata.name}`, file, validation);
      skills.push(skill);
    } catch (e) {
      errors.push({
        component: "skill",
        file,
        message: `Failed to parse: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  // 3. Discover and parse agents
  const agentFiles = discoverComponents(dir, manifest.agents, "AGENT.md");
  const agents: AgentDefinition[] = [];
  for (const file of agentFiles) {
    try {
      const parsed = parseMarkdownFile(file, { fixYamlDescriptions: fixYaml });
      const agent = parseAgent(parsed);
      const validation = validateAgent({
        ...agent.metadata,
        permissionMode: agent.permissionMode,
        memory: agent.memory,
        maxTurns: agent.maxTurns,
      });
      collectErrors(errors, `agent:${agent.metadata.name}`, file, validation);
      agents.push(agent);
    } catch (e) {
      errors.push({
        component: "agent",
        file,
        message: `Failed to parse: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  // 4. Discover and parse hooks
  const hookFiles = discoverComponents(dir, manifest.hooks, "HOOK.md");
  const hooks: HookDefinition[] = [];
  for (const file of hookFiles) {
    try {
      const parsed = parseMarkdownFile(file, { fixYamlDescriptions: fixYaml });
      const hook = parseHook(parsed);
      const validation = validateHook({
        ...hook.metadata,
        event: hook.event,
        handlers: hook.handlers,
        fallback: hook.fallback,
      });
      collectErrors(errors, `hook:${hook.metadata.name}`, file, validation);
      hooks.push(hook);
    } catch (e) {
      errors.push({
        component: "hook",
        file,
        message: `Failed to parse: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  // 5. Discover and parse tools
  const toolFiles = discoverComponents(dir, manifest.tools, "TOOL.md");
  const tools: ToolDefinition[] = [];
  for (const file of toolFiles) {
    try {
      const parsed = parseMarkdownFile(file, { fixYamlDescriptions: fixYaml });
      const tool = parseTool(parsed);
      const validation = validateTool({
        ...tool.metadata,
        parameters: tool.parameters,
        implementation: tool.implementation,
      });
      collectErrors(errors, `tool:${tool.metadata.name}`, file, validation);
      tools.push(tool);
    } catch (e) {
      errors.push({
        component: "tool",
        file,
        message: `Failed to parse: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  // 6. Discover and parse policies
  const policyFiles = discoverComponents(dir, manifest.policies, "POLICY.md");
  const policies: PolicyDefinition[] = [];
  for (const file of policyFiles) {
    try {
      const parsed = parseMarkdownFile(file, { fixYamlDescriptions: fixYaml });
      const policy = parsePolicy(parsed);
      const validation = validatePolicy({
        ...policy.metadata,
        permissions: policy.permissions,
      });
      collectErrors(errors, `policy:${policy.metadata.name}`, file, validation);
      policies.push(policy);
    } catch (e) {
      errors.push({
        component: "policy",
        file,
        message: `Failed to parse: ${(e as Error).message}`,
        severity: "error",
      });
    }
  }

  // 7. Discover rules
  const rules = discoverRules(dir, manifest.rules);

  // Build IR
  const ir: ExtensionIR = {
    manifest,
    skills,
    agents,
    hooks,
    tools,
    policies,
    rules,
  };

  const hasErrors = errors.some((e) => e.severity === "error");

  return { ir, errors, valid: !hasErrors };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectErrors(
  errors: ResolveError[],
  component: string,
  file: string,
  validation: ValidationResult
): void {
  for (const err of validation.errors) {
    errors.push({
      component,
      file,
      message: `${err.path}: ${err.message}`,
      severity: "error",
    });
  }
  for (const warn of validation.warnings) {
    errors.push({
      component,
      file,
      message: `${warn.path}: ${warn.message}`,
      severity: "warning",
    });
  }
}
