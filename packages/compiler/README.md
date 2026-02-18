# @ai-ext/compiler

Multi-target extension compiler for the ai-ext platform.

## Overview

This package transforms a validated `ExtensionIR` into host-specific configuration files. It's the **write side** of the pipeline — taking the canonical representation and generating the exact file formats each host expects.

## Key Files

| File | Purpose |
|------|---------|
| `src/compiler.ts` | Main `compile(options)` pipeline: resolve IR -> target.compile() -> write files |
| `src/targets/target.ts` | `CompilationTarget` interface that all target adapters implement |
| `src/targets/claude.ts` | Claude Code adapter: `.claude/` directory, settings.json, .mcp.json |
| `src/targets/kilocode.ts` | KiloCode adapter: `.kilocode/`, .kilocodemodes, workflows |
| `src/targets/opencode.ts` | OpenCode adapter: `.opencode/`, plugins, native tools, opencode.json |
| `src/index.ts` | Public API |

## Usage

### Compile an Extension

```typescript
import { compile } from "@ai-ext/compiler";

const result = compile({
  target: "claude",
  sourceDir: "./my-extension",
  outDir: "./output",      // Optional: defaults to sourceDir
  verbose: true,
  dryRun: false,
});

console.log(`Generated ${result.files.size} files`);
console.log(`Warnings: ${result.warnings.length}`);
console.log(`Runtime required: ${result.runtimeRequired.length}`);
```

### List Supported Targets

```typescript
import { getSupportedTargets } from "@ai-ext/compiler";

console.log(getSupportedTargets()); // ["claude", "kilocode", "opencode"]
```

### Use a Specific Target Directly

```typescript
import { ClaudeTarget } from "@ai-ext/compiler";
import { resolveExtension } from "@ai-ext/core";

const { ir } = resolveExtension("./my-extension");
const target = new ClaudeTarget();
const output = target.compile(ir);
```

## Target Output Summary

### Claude Code (`claude`)

| Input | Output |
|-------|--------|
| Skills | `.claude/skills/<name>/SKILL.md` |
| Agents | `.claude/agents/<name>.md` |
| Hooks | `.claude/settings.json` hooks section |
| Policies | `.claude/settings.json` permissions section |
| Rules | `.claude/rules/<name>.md` + `CLAUDE.md` |
| Tools | `.mcp.json` (runtime MCP server reference) |

### KiloCode (`kilocode`)

| Input | Output |
|-------|--------|
| Skills | `.kilocode/skills/<name>/SKILL.md` + `.kilocode/workflows/<name>.md` |
| Agents | `.kilocodemodes` (Custom Modes YAML) |
| Hooks | Runtime MCP bridge (no native support) |
| Policies | `.kilocode/rules/policy-<name>.md` (instruction text) |
| Rules | `.kilocode/rules/<name>.md` + `AGENTS.md` |
| Tools | `.kilocode/mcp.json` (runtime MCP server reference) |

### OpenCode (`opencode`)

| Input | Output |
|-------|--------|
| Skills | `.opencode/skills/<name>/SKILL.md` + `.opencode/commands/<name>.md` |
| Agents | `.opencode/agents/<name>.md` |
| Hooks | `.opencode/plugins/ai-ext-hooks.ts` (plugin module) |
| Policies | Agent-level permissions (warnings for unsupported patterns) |
| Rules | `AGENTS.md` |
| Tools | `.opencode/tools/<name>.ts` (native) + `opencode.json` MCP section |

## Build

```bash
bun run build         # Bundle + declarations
bun run typecheck     # Type-check only
```

Depends on `@ai-ext/schema` and `@ai-ext/core` — build those first.
