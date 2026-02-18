# @ai-ext/schema

Canonical DSL type definitions, JSON Schema, and runtime validation for the ai-ext platform.

## Overview

This is the **foundation package** of ai-ext. Every other package depends on it. It defines:

- **TypeScript types** for all 6 extension components (skills, agents, hooks, tools, policies, rules)
- **The ExtensionIR** — the intermediate representation that the compiler transforms into host-specific output
- **Runtime validators** for parsed YAML/frontmatter data
- **JSON Schema** definitions for extension manifests

## Key Files

| File | Purpose |
|------|---------|
| `src/types.ts` | All canonical DSL types. Single source of truth for the extension format. |
| `src/validator.ts` | Runtime validators for each component type. Returns structured `ValidationResult`. |
| `src/index.ts` | Public API — re-exports all types and validators. |
| `schemas/extension.schema.json` | JSON Schema for `extension.yaml` manifest validation. |

## Types Overview

### Extension Components

| Type | Description |
|------|-------------|
| `SkillDefinition` | Behavioral contract with invocation control, tool access, execution context |
| `AgentDefinition` | Planner/executor with model, tools, permissions, memory, MCP servers |
| `HookDefinition` | Event-triggered handler with fallback strategies for unsupported hosts |
| `ToolDefinition` | Capability contract with parameter schema, implementation, MCP/native exposure |
| `PolicyDefinition` | Permission rules (allow/deny/ask) and sandbox configuration |

### Core Infrastructure Types

| Type | Description |
|------|-------------|
| `ExtensionManifest` | Top-level `extension.yaml` manifest |
| `ExtensionIR` | Fully resolved in-memory representation of an extension |
| `BuildOptions` | Options for the compile command |
| `BuildResult` | Compilation output with files, warnings, runtime requirements |
| `TargetHost` | Supported compilation targets (`"claude" \| "kilocode" \| "opencode"`) |

## Usage

```typescript
import type { ExtensionIR, SkillDefinition, TargetHost } from "@ai-ext/schema";
import { validateSkill, validateManifest } from "@ai-ext/schema";

// Validate a parsed skill
const result = validateSkill({
  name: "my-skill",
  description: "Does something useful",
  // ...
});

if (!result.valid) {
  console.error(result.errors);
}
```

## Validators

Each validator returns a `ValidationResult`:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];   // severity: "error"
  warnings: ValidationError[]; // severity: "warning"
}
```

Available validators:
- `validateManifest(data)` — Validates extension.yaml
- `validateSkill(data)` — Validates skill frontmatter
- `validateAgent(data)` — Validates agent frontmatter
- `validateHook(data)` — Validates hook frontmatter
- `validateTool(data)` — Validates tool frontmatter
- `validatePolicy(data)` — Validates policy frontmatter

## Build

```bash
bun run build         # Bundle + generate declarations
bun run typecheck     # Type-check only
```
