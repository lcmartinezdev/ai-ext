# @ai-ext/cli — Agent Instructions

You are working in the `@ai-ext/cli` package. This is the user-facing CLI entry point for the ai-ext platform.

## Responsibilities

- Provide the `ai-ext` CLI with `init`, `validate`, `build`, and `serve` commands
- Parse command-line arguments and options
- Delegate to the appropriate package for each operation
- Provide clear, actionable output to the user

## Dependencies

- `@ai-ext/schema` — types
- `@ai-ext/core` — `resolveExtension()` for validate/build/serve
- `@ai-ext/compiler` — `compile()` for build
- `@ai-ext/runtime` — `startRuntimeServer()` for serve
- `commander` — CLI argument parsing
- `chalk` — Terminal colors (not yet used, available for enhancement)
- `ora` — Spinner/progress (not yet used, available for enhancement)

## File Guide

- `src/cli.ts` — Entry point. Uses Commander to define commands and options. This is the file that gets built as the binary.
- `src/commands/init.ts` — `initExtension()`. Creates directories, writes `extension.yaml` scaffold, example skill, example rule. Checks for existing extension to prevent accidental overwrites.
- `src/commands/build.ts` — `buildExtension()`. Validates target names, calls `compile()` for each target, reports files generated, warnings, and runtime requirements.
- `src/commands/validate.ts` — `validateExtension()`. Calls `resolveExtension()`, reports component counts, errors, and warnings.
- `src/commands/serve.ts` — `serveRuntime()`. Resolves the extension, validates it, then starts the MCP server on stdio.
- `src/index.ts` — Programmatic exports for all commands (for use as a library).

## Key Design Patterns

1. **Fail fast with clear messages.** All commands validate input early and `process.exit(1)` on errors with descriptive messages.
2. **Verbose mode.** Use `-v` / `--verbose` to show per-file output and detailed warnings.
3. **Dry run support.** The `build` command supports `--dry-run` to preview output without writing files.
4. **Multiple targets.** `build --target` accepts multiple values: `--target claude kilocode opencode`.

## Planned Commands

- `ai-ext dev` — Watch mode with auto-rebuild on file changes
- `ai-ext publish` — Publish to extension registry (Phase 3)
- `ai-ext install` — Install extensions from registry (Phase 3)

## Common Tasks

### Add a new CLI command

1. Create `src/commands/<name>.ts` with the command logic
2. Import and register it in `src/cli.ts` using `program.command()`
3. Export from `src/index.ts`

### Add a new option to an existing command

Update the Commander chain in `src/cli.ts` (`.option()` / `.requiredOption()`) and update the options interface in the corresponding command file.

## Build

```bash
bun run build   # Requires all other packages to be built first
```

## Running from Source

```bash
bun packages/cli/src/cli.ts <command> [options]
```
