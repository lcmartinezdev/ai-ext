# @ai-ext/compiler — Agent Instructions

You are working in the `@ai-ext/compiler` package. This transforms the canonical `ExtensionIR` into host-specific configuration files for Claude Code, KiloCode, and OpenCode.

## Responsibilities

- Implement the `CompilationTarget` interface for each host
- Transform canonical components into host-native file formats
- Handle feature gaps between hosts (inject runtime bridges when needed)
- Report warnings for lossy translations
- Track runtime requirements (features needing the MCP server)

## Dependencies

- `@ai-ext/schema` — types (must be built first)
- `@ai-ext/core` — `resolveExtension()` for loading (must be built first)
- `yaml` — YAML serialization for output files
- `gray-matter` — Markdown + frontmatter serialization
- `handlebars` — Template rendering for tool commands

## File Guide

- `src/compiler.ts` — The orchestrator. `compile(options)` validates the target, resolves the extension to IR, calls `target.compile(ir)`, and writes output files. Also holds the target registry.
- `src/targets/target.ts` — The `CompilationTarget` interface. Every target implements `compile(ir) -> TargetOutput`.
- `src/targets/claude.ts` — Claude Code adapter. Claude Code has the richest native support (hooks, permissions, subagents, MCP). Most features map directly.
- `src/targets/kilocode.ts` — KiloCode adapter. Agents become Custom Modes. Hooks require runtime bridge. Policies become rule instruction text. Skills also emit as workflows for slash commands.
- `src/targets/opencode.ts` — OpenCode adapter. Hooks become TypeScript plugin modules. Tools emit as native `.ts` files with Zod schemas. Config goes to `opencode.json`.

## Key Design Patterns

### Feature Gap Handling

When a host lacks native support for a canonical feature:

1. **Runtime bridge** (`mcp-tool` fallback) — Inject an MCP server reference (`ai-ext serve`) that emulates the feature
2. **Instruction injection** (`skill-injection` fallback) — Convert the feature into agent instructions
3. **Ignore** — Skip the feature with a warning

The `runtimeRequirements` array in `TargetOutput` tracks what the runtime server needs to provide.

### Host-Specific Mappings

| Canonical Concept | Claude Code | KiloCode | OpenCode |
|---|---|---|---|
| Agent | Subagent (`.claude/agents/`) | Custom Mode (`.kilocodemodes`) | Agent (`.opencode/agents/`) |
| Invocable Skill | Slash command | Workflow | Command |
| Tool Access | `tools` / `disallowedTools` | Mode groups (`read`, `edit`, `command`, `mcp`) | `permission` / `tools` |
| Permissions | `settings.json` permissions block | Mode tool groups | Per-agent `permission` field |

### YAML/Frontmatter Rendering

Each target has a `renderMarkdownWithFrontmatter()` helper that serializes frontmatter to YAML and combines it with the markdown body. Currently uses simple string concatenation; should be upgraded to use the `yaml` library for proper quoting.

## Adding a New Target

1. Create `src/targets/<host>.ts` implementing `CompilationTarget`
2. Import and register it in `src/compiler.ts` in the `targets` record
3. Add the host name to `TargetHost` in `@ai-ext/schema`
4. Export from `src/index.ts`
5. Add an example extension build to verify output

## Common Issues

- **YAML quoting** — Values containing colons, quotes, or special characters need proper YAML escaping. The current `renderMarkdownWithFrontmatter` is naive. Use the `yaml` library's `stringify()` for robustness.
- **Path separators** — Always use forward slashes in generated file paths (cross-platform).
- **Runtime requirements** — Always push to `runtimeRequirements` when injecting an MCP server reference, so the CLI can inform the user.

## Build

```bash
bun run build   # Must build @ai-ext/schema and @ai-ext/core first
```
