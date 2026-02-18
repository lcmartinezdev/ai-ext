# ai-ext — Agent Instructions

You are working on **ai-ext**, a Universal AI Agent Extension Platform. This is a cross-agent runtime platform that compiles portable extension definitions into host-specific configurations for Claude Code, KiloCode, and OpenCode.

## Project Overview

This is a TypeScript monorepo using Bun workspaces. The codebase is organized into 5 packages under `packages/`:

| Package | Path | Purpose |
|---------|------|---------|
| `@ai-ext/schema` | `packages/schema/` | Canonical DSL types, JSON Schema definitions, runtime validators |
| `@ai-ext/core` | `packages/core/` | Extension loader (YAML + frontmatter), parsers, IR resolver |
| `@ai-ext/compiler` | `packages/compiler/` | Multi-target compiler with Claude, KiloCode, OpenCode code generators |
| `@ai-ext/runtime` | `packages/runtime/` | MCP-compatible tool server, hook emulation engine, memory store |
| `@ai-ext/cli` | `packages/cli/` | CLI entry point (`ai-ext init/validate/build/serve`) |

There is also an example extension at `extensions/example/` that exercises all component types.

## Dependency Graph

```
@ai-ext/schema  (no deps — foundation)
       |
  @ai-ext/core  (depends on schema)
       |
  +----+----+
  |         |
@ai-ext/compiler  @ai-ext/runtime  (both depend on schema + core)
  |         |
  +----+----+
       |
  @ai-ext/cli  (depends on all)
```

## Key Concepts

### Canonical Extension Format

Extensions are authored as Markdown files with extended YAML frontmatter, building on the [Agent Skills](https://agentskills.io) open specification. The 6 component types are:

- **Skills** (`SKILL.md`) — Behavioral contracts with invocation control, tool access, execution context
- **Agents** (`AGENT.md`) — Planner/executor definitions with model, tools, permissions, memory
- **Hooks** (`HOOK.md`) — Event-triggered handlers (command, prompt, or agent type) with fallback strategies
- **Tools** (`TOOL.md`) — Capability contracts with parameter schemas, implementations, MCP/native exposure
- **Policies** (`POLICY.md`) — Permission rules (allow/deny/ask patterns) and sandbox configuration
- **Rules** (`*.md`) — Plain markdown instruction files

### Compilation Pipeline

```
YAML/MD Sources --> Loader --> Validator --> IR (ExtensionIR) --> Target Emitter --> Host Files
```

The IR (`ExtensionIR` in `packages/schema/src/types.ts`) is the central data structure — a fully resolved, validated in-memory representation of an extension.

### Target Adapters

Each target host has a `CompilationTarget` implementation in `packages/compiler/src/targets/`:

- `claude.ts` — Generates `.claude/` directory structure (settings.json, skills, agents, rules, .mcp.json)
- `kilocode.ts` — Generates `.kilocode/` directory structure (skills, workflows, .kilocodemodes, rules, mcp.json)
- `opencode.ts` — Generates `.opencode/` directory structure (skills, commands, agents, plugins, tools, opencode.json)

### Runtime Compensation

When a target host lacks native support for a feature (e.g., KiloCode has no hooks), the compiler injects a reference to the `ai-ext serve` MCP server, which provides:

- **Tool routing** — Canonical tools exposed via MCP protocol
- **Hook emulation** — Hooks exposed as MCP tools the agent is instructed to call
- **Memory** — Session and project-scoped key-value store via MCP tools/resources

## Code Style

- TypeScript with strict mode enabled
- ES2022 target, ESNext modules, bundler module resolution
- `const` by default, `let` only when needed
- Explicit return types on exported functions
- `interface` for object shapes, `type` for unions/intersections
- 2-space indentation, semicolons, double quotes in TypeScript

## Build & Development

```bash
# Install dependencies
bun install

# Typecheck all packages (must build schema + core first for declarations)
bun run --filter '@ai-ext/schema' build
bun run --filter '@ai-ext/core' build
bun run --filter '*' typecheck

# Run the CLI directly (no build step needed with Bun)
bun packages/cli/src/cli.ts <command>

# Build all packages
bun run --filter '*' build
```

When modifying `@ai-ext/schema` or `@ai-ext/core`, rebuild them before typechecking downstream packages since TypeScript project references require built declaration files.

## Important Files

- `packages/schema/src/types.ts` — The canonical type system. All extension components are defined here. This is the single source of truth for the DSL.
- `packages/schema/src/validator.ts` — Runtime validators for each component type. Used by the resolver.
- `packages/core/src/resolver.ts` — The main entry point for loading an extension. `resolveExtension(dir)` returns a fully populated `ExtensionIR`.
- `packages/compiler/src/compiler.ts` — The compile orchestrator. `compile(options)` transforms IR to host files.
- `packages/compiler/src/targets/target.ts` — The `CompilationTarget` interface. Implement this to add new host targets.
- `packages/runtime/src/server.ts` — The MCP server. `startRuntimeServer(options)` runs on stdio transport.
- `packages/cli/src/cli.ts` — CLI entry point using commander.

## Adding a New Target Host

1. Create `packages/compiler/src/targets/<host>.ts` implementing `CompilationTarget`
2. Register it in `packages/compiler/src/compiler.ts` in the `targets` record
3. Add the host name to `TargetHost` type in `packages/schema/src/types.ts`
4. Add an example build command in the CLI help text

## Adding a New Component Type

1. Define the type in `packages/schema/src/types.ts`
2. Add a validator in `packages/schema/src/validator.ts`
3. Export from `packages/schema/src/index.ts`
4. Add a parser in `packages/core/src/parser.ts`
5. Add discovery logic in `packages/core/src/resolver.ts`
6. Add emitters in each target adapter in `packages/compiler/src/targets/`
