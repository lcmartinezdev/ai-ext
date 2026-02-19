/**
 * @ai-ext/compiler — Main Compilation Pipeline
 *
 * Orchestrates: Source Dir → Resolve IR → Target.compile() → Write Files
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type {
  BuildOptions,
  BuildResult,
  TargetHost,
} from "@ai-ext/schema";
import { resolveExtension } from "@ai-ext/core";
import type { CompilationTarget } from "./targets/target.js";
import { ClaudeTarget } from "./targets/claude.js";
import { KiloCodeTarget } from "./targets/kilocode.js";
import { OpenCodeTarget } from "./targets/opencode.js";

// ---------------------------------------------------------------------------
// Target Registry
// ---------------------------------------------------------------------------

const targets: Record<TargetHost, CompilationTarget> = {
  claude: new ClaudeTarget(),
  kilocode: new KiloCodeTarget(),
  opencode: new OpenCodeTarget(),
};

/**
 * Get all supported target names.
 */
export function getSupportedTargets(): TargetHost[] {
  return Object.keys(targets) as TargetHost[];
}

/**
 * Get a specific compilation target.
 */
export function getTarget(name: TargetHost): CompilationTarget | undefined {
  return targets[name];
}

// ---------------------------------------------------------------------------
// Compile Pipeline
// ---------------------------------------------------------------------------

/**
 * Compile an extension for a specific target host.
 *
 * @param options - Build options
 * @returns Build result with generated files, warnings, and runtime requirements
 */
export function compile(options: BuildOptions): BuildResult {
  const { target: targetName, sourceDir, outDir, verbose, dryRun, fixYamlDescriptions } = options;

  // 1. Validate target
  const target = targets[targetName];
  if (!target) {
    throw new Error(
      `Unknown target "${targetName}". Supported targets: ${getSupportedTargets().join(", ")}`
    );
  }

  // 2. Resolve extension to IR
  const { ir, errors, valid } = resolveExtension(sourceDir, { fixYamlDescriptions });

  if (!valid) {
    const errorMessages = errors
      .filter((e) => e.severity === "error")
      .map((e) => `  ${e.component} (${e.file}): ${e.message}`)
      .join("\n");
    throw new Error(`Extension validation failed:\n${errorMessages}`);
  }

  // Log warnings
  const resolveWarnings = errors.filter((e) => e.severity === "warning");
  if (verbose && resolveWarnings.length > 0) {
    for (const w of resolveWarnings) {
      console.warn(`  [warn] ${w.component}: ${w.message}`);
    }
  }

  // 3. Compile IR to target
  const result = target.compile(ir);

  // 4. Write output files (unless dry run)
  //    Default output goes to dist/<target>/ so the user gets a self-contained
  //    folder they can copy into their project root.
  //    --out-dir overrides this entirely.
  if (!dryRun) {
    const outputBase = outDir || join(sourceDir, "dist", targetName);

    for (const [relativePath, content] of result.files) {
      const fullPath = join(outputBase, relativePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
    }
  }

  return {
    target: targetName,
    files: result.files,
    warnings: [
      // Include resolve warnings
      ...resolveWarnings.map((w) => ({
        component: w.component,
        message: w.message,
        severity: "warn" as const,
      })),
      // Include target warnings
      ...result.warnings,
    ],
    runtimeRequired: result.runtimeRequirements,
  };
}
