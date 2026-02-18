/**
 * ai-ext build — Compile an extension for a target host
 */

import { resolve } from "node:path";
import type { TargetHost, BuildOptions } from "@ai-ext/schema";
import { compile, getSupportedTargets } from "@ai-ext/compiler";

export interface BuildCommandOptions {
  /** Target host(s) to compile for */
  target: string | string[];
  /** Source directory */
  dir: string;
  /** Output directory override */
  outDir?: string;
  /** Verbose logging */
  verbose?: boolean;
  /** Dry run */
  dryRun?: boolean;
}

export function buildExtension(options: BuildCommandOptions): void {
  const sourceDir = resolve(options.dir);
  const targets = Array.isArray(options.target)
    ? options.target
    : [options.target];

  const supported = getSupportedTargets();

  for (const target of targets) {
    if (!supported.includes(target as TargetHost)) {
      console.error(
        `Unknown target "${target}". Supported: ${supported.join(", ")}`
      );
      process.exit(1);
    }

    console.log(`\nCompiling for ${target}...`);

    try {
      const buildOptions: BuildOptions = {
        target: target as TargetHost,
        sourceDir,
        outDir: options.outDir ? resolve(options.outDir) : undefined,
        verbose: options.verbose,
        dryRun: options.dryRun,
      };

      const result = compile(buildOptions);

      // Report results
      const fileCount = result.files.size;
      console.log(`  Generated ${fileCount} file(s)`);

      if (options.verbose || options.dryRun) {
        for (const [path] of result.files) {
          console.log(`    ${options.dryRun ? "[dry] " : ""}${path}`);
        }
      }

      // Report warnings
      if (result.warnings.length > 0) {
        console.log(`  ${result.warnings.length} warning(s):`);
        for (const w of result.warnings) {
          console.log(`    [${w.severity}] ${w.component}: ${w.message}`);
        }
      }

      // Report runtime requirements
      if (result.runtimeRequired.length > 0) {
        console.log(`  Runtime required for:`);
        for (const r of result.runtimeRequired) {
          console.log(`    - ${r.feature}: ${r.reason}`);
        }
        console.log(
          `  Run 'ai-ext serve' to start the runtime MCP server.`
        );
      }

      console.log(`  Done.`);
    } catch (err) {
      console.error(`  Error: ${(err as Error).message}`);
      process.exit(1);
    }
  }
}
