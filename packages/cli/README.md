# @ai-ext/cli

The `ai-ext` command-line interface for the Universal AI Agent Extension Platform.

## Overview

This is the user-facing entry point for ai-ext. It provides 4 commands:

| Command | Description |
|---------|-------------|
| `ai-ext init` | Initialize a new extension project with scaffold |
| `ai-ext validate` | Validate an extension (load, parse, check all components) |
| `ai-ext build` | Compile an extension for one or more target hosts |
| `ai-ext serve` | Start the runtime MCP server |

## Commands

### `ai-ext init`

Creates a new extension project with scaffolded directories and example files.

```bash
ai-ext init                          # Initialize in current directory
ai-ext init -d ./my-extension        # Initialize in specific directory
ai-ext init -n my-team-standards     # Set the extension name
```

Generated structure:

```
my-extension/
  extension.yaml
  skills/example/SKILL.md
  agents/
  hooks/
  tools/
  policies/
  rules/project-rules.md
```

### `ai-ext validate`

Loads and validates an extension without generating any output.

```bash
ai-ext validate                      # Validate current directory
ai-ext validate -d ./my-extension    # Validate specific directory
ai-ext validate -v                   # Verbose output
ai-ext validate --fix               # Auto-fix YAML description issues
```

Reports component counts, errors, and warnings.

The `--fix` flag will automatically quote descriptions that contain YAML-special characters (like `"`, `:`, `#`, etc.) to ensure they parse correctly.

### `ai-ext build`

Compiles an extension for one or more target hosts.

```bash
ai-ext build --target claude                  # Single target
ai-ext build --target claude kilocode opencode # Multiple targets
ai-ext build --target claude -d ./my-ext      # Specific source directory
ai-ext build --target claude -o ./output      # Custom output directory
ai-ext build --target claude --dry-run -v     # Preview without writing
```

### `ai-ext serve`

Starts the runtime MCP server on stdio transport.

```bash
ai-ext serve                         # Serve current directory's extension
ai-ext serve -d ./my-extension       # Serve specific extension
```

## Running Without Build

With Bun, you can run the CLI directly from source:

```bash
bun packages/cli/src/cli.ts <command>
```

## Build

```bash
bun run build         # Bundle to dist/cli.js
bun run typecheck     # Type-check only
```

The built CLI can be run with:

```bash
node dist/cli.js <command>
```

## Dependencies

This package depends on all other ai-ext packages:

- `@ai-ext/schema` — types
- `@ai-ext/core` — extension resolution
- `@ai-ext/compiler` — compilation pipeline
- `@ai-ext/runtime` — MCP server
- `commander` — CLI framework
- `chalk` — Terminal colors
- `ora` — Spinner animations
