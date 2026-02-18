# @ai-ext/core — Agent Instructions

You are working in the `@ai-ext/core` package. This handles loading, parsing, and resolving canonical extension source files into a validated `ExtensionIR`.

## Responsibilities

- Load `extension.yaml` manifests from disk
- Discover component files (`SKILL.md`, `AGENT.md`, `HOOK.md`, `TOOL.md`, `POLICY.md`) in extension directories
- Parse YAML frontmatter from markdown files
- Transform raw frontmatter into strongly-typed DSL components
- Validate all components via `@ai-ext/schema` validators
- Build the `ExtensionIR` (intermediate representation) consumed by the compiler

## Dependencies

- `@ai-ext/schema` — types and validators (must be built first)
- `yaml` — YAML parsing
- `gray-matter` — Markdown frontmatter extraction
- `glob` — File pattern matching

## File Guide

- `src/loader.ts` — Low-level file I/O. `loadManifest()` reads extension.yaml. `discoverComponents()` recursively finds files by name. `parseMarkdownFile()` extracts frontmatter + body. `discoverRules()` finds plain markdown rule files.
- `src/parser.ts` — One `parse*` function per component type. Handles the mapping from raw YAML frontmatter keys (including Agent Skills spec conventions like `allowed-tools`, `disable-model-invocation`) to canonical typed fields. Also handles inline hooks embedded in skill/agent frontmatter.
- `src/resolver.ts` — `resolveExtension(dir)` is the main entry point. Orchestrates the full pipeline: load manifest -> discover files -> parse each -> validate -> assemble IR.

## Key Design Decisions

1. **Case-insensitive file matching.** `SKILL.md` and `skill.md` both match.
2. **Agent Skills spec compatibility.** Parsers handle both the Agent Skills spec field names (e.g., `allowed-tools`, `disable-model-invocation`) and our canonical names (e.g., `tools.allowed`, `invocation.modelInvocable`).
3. **Inline hooks.** Skills and agents can embed hooks in their frontmatter using the same structure as Claude Code's hooks config. The parser extracts these into `HookDefinition[]`.
4. **Graceful error handling.** If a single component fails to parse, it's recorded as an error but other components continue loading. The `valid` flag is only false if there are severity "error" entries.

## Common Tasks

### Add support for a new frontmatter field

1. Add the field to the relevant type in `@ai-ext/schema/src/types.ts`
2. Parse it in the corresponding `parse*` function in `src/parser.ts`
3. If it needs validation, add a check in `@ai-ext/schema/src/validator.ts`

### Add a new component type

1. Define the type in `@ai-ext/schema`
2. Add a `parse<Type>` function in `src/parser.ts`
3. Add discovery + resolution in `src/resolver.ts` (follow the pattern of existing components)
4. Export from `src/index.ts`

## Build

```bash
bun run build   # Must build @ai-ext/schema first
```
