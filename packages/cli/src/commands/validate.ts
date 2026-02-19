/**
 * ai-ext validate — Validate an extension without compiling
 */

import { resolve } from "node:path";
import { resolveExtension } from "@ai-ext/core";

export interface ValidateCommandOptions {
  /** Directory containing the extension */
  dir: string;
  /** Verbose logging */
  verbose?: boolean;
  /** Auto-fix YAML description issues */
  fix?: boolean;
}

export function validateExtension(options: ValidateCommandOptions): void {
  const dir = resolve(options.dir);

  console.log(`Validating extension at ${dir}...`);

  try {
    const { ir, errors, valid } = resolveExtension(dir, {
      fixYamlDescriptions: options.fix,
    });

    // Summary
    console.log(`\n  Components found:`);
    console.log(`    Skills:   ${ir.skills.length}`);
    console.log(`    Agents:   ${ir.agents.length}`);
    console.log(`    Hooks:    ${ir.hooks.length}`);
    console.log(`    Tools:    ${ir.tools.length}`);
    console.log(`    Policies: ${ir.policies.length}`);
    console.log(`    Rules:    ${ir.rules.size}`);

    // Errors
    const errs = errors.filter((e) => e.severity === "error");
    const warns = errors.filter((e) => e.severity === "warning");

    if (errs.length > 0) {
      console.log(`\n  ${errs.length} error(s):`);
      for (const e of errs) {
        console.log(`    [error] ${e.component} (${e.file}): ${e.message}`);
      }
    }

    if (warns.length > 0) {
      console.log(`\n  ${warns.length} warning(s):`);
      for (const w of warns) {
        console.log(`    [warn] ${w.component} (${w.file}): ${w.message}`);
      }
    }

    if (valid) {
      console.log(`\n  Extension is valid.`);
    } else {
      console.log(`\n  Extension has errors. Fix them before building.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`  Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
