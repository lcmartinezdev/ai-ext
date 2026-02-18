#!/usr/bin/env bun
/**
 * ai-ext CLI — Universal AI Agent Extension Platform
 *
 * Commands:
 *   ai-ext init                    Initialize a new extension project
 *   ai-ext validate                Validate an extension
 *   ai-ext build --target <host>   Compile for a target host
 *   ai-ext serve                   Start the runtime MCP server
 */

import { Command } from "commander";
import { initExtension } from "./commands/init.js";
import { buildExtension } from "./commands/build.js";
import { validateExtension } from "./commands/validate.js";
import { serveRuntime } from "./commands/serve.js";

const program = new Command();

program
  .name("ai-ext")
  .description(
    "Universal AI Agent Extension Platform — portable skills, agents, hooks, and tools across AI coding environments"
  )
  .version("0.1.0");

// -------------------------------------------------------------------------
// init
// -------------------------------------------------------------------------

program
  .command("init")
  .description("Initialize a new extension project")
  .option("-d, --dir <path>", "Directory to initialize", ".")
  .option("-n, --name <name>", "Extension name")
  .action((opts) => {
    try {
      initExtension({ dir: opts.dir, name: opts.name });
      console.log("Extension initialized successfully.");
      console.log("\nNext steps:");
      console.log("  1. Edit extension.yaml to configure your extension");
      console.log("  2. Add skills, agents, hooks, tools, and policies");
      console.log("  3. Run 'ai-ext validate' to check your extension");
      console.log(
        "  4. Run 'ai-ext build --target <host>' to compile for a specific host"
      );
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// -------------------------------------------------------------------------
// validate
// -------------------------------------------------------------------------

program
  .command("validate")
  .description("Validate an extension without compiling")
  .option("-d, --dir <path>", "Extension directory", ".")
  .option("-v, --verbose", "Verbose output")
  .action((opts) => {
    validateExtension({ dir: opts.dir, verbose: opts.verbose });
  });

// -------------------------------------------------------------------------
// build
// -------------------------------------------------------------------------

program
  .command("build")
  .description("Compile an extension for target host(s)")
  .requiredOption(
    "-t, --target <hosts...>",
    "Target host(s): claude, kilocode, opencode"
  )
  .option("-d, --dir <path>", "Extension source directory", ".")
  .option("-o, --out-dir <path>", "Output directory (default: source dir)")
  .option("-v, --verbose", "Verbose output")
  .option("--dry-run", "Show what would be generated without writing")
  .action((opts) => {
    buildExtension({
      target: opts.target,
      dir: opts.dir,
      outDir: opts.outDir,
      verbose: opts.verbose,
      dryRun: opts.dryRun,
    });
  });

// -------------------------------------------------------------------------
// serve
// -------------------------------------------------------------------------

program
  .command("serve")
  .description("Start the runtime MCP server (stdio transport)")
  .option("-d, --dir <path>", "Extension directory", ".")
  .action(async (opts) => {
    await serveRuntime({ dir: opts.dir });
  });

// -------------------------------------------------------------------------
// Parse
// -------------------------------------------------------------------------

program.parse();
