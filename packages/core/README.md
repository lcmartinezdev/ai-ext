# @ai-ext/core

Extension loader, parser, and resolver for the ai-ext platform.

## Overview

This package handles the **read side** of the pipeline: loading canonical extension source files from disk, parsing YAML frontmatter and markdown content, and resolving everything into a validated `ExtensionIR`.

## Key Files

| File | Purpose |
|------|---------|
| `src/loader.ts` | File I/O: loads `extension.yaml`, discovers component files, parses markdown frontmatter |
| `src/parser.ts` | Transforms raw frontmatter + body into strongly-typed DSL components |
| `src/resolver.ts` | Top-level `resolveExtension(dir)` — orchestrates loading, parsing, validation into IR |
| `src/index.ts` | Public API |

## Usage

### Resolve an Extension

```typescript
import { resolveExtension } from "@ai-ext/core";

const { ir, errors, valid } = resolveExtension("./my-extension");

if (valid) {
  console.log(`Loaded ${ir.skills.length} skills, ${ir.agents.length} agents`);
} else {
  console.error(errors.filter(e => e.severity === "error"));
}
```

### Parse a Single Component

```typescript
import { parseMarkdownFile, parseSkill } from "@ai-ext/core";

const component = parseMarkdownFile("./skills/review/SKILL.md");
const skill = parseSkill(component);
```

### Load Just the Manifest

```typescript
import { loadManifest } from "@ai-ext/core";

const manifest = loadManifest("./my-extension");
// { name, version, description, skills, agents, hooks, tools, policies, rules }
```

## Resolution Pipeline

```
extension.yaml
    |
    v
loadManifest() -> ExtensionManifest
    |
    v
discoverComponents() -> find SKILL.md, AGENT.md, HOOK.md, TOOL.md, POLICY.md files
    |
    v
parseMarkdownFile() -> { frontmatter, body, sourcePath }
    |
    v
parseSkill/Agent/Hook/Tool/Policy() -> typed component
    |
    v
validate*() -> check constraints
    |
    v
ExtensionIR { manifest, skills, agents, hooks, tools, policies, rules }
```

## Component Discovery

The resolver scans directories referenced in `extension.yaml`:

| Manifest Field | Looks For | Example Path |
|---------------|-----------|--------------|
| `skills` | `SKILL.md` (recursive) | `skills/review/SKILL.md` |
| `agents` | `AGENT.md` (recursive) | `agents/reviewer/AGENT.md` |
| `hooks` | `HOOK.md` (recursive) | `hooks/lint/HOOK.md` |
| `tools` | `TOOL.md` (recursive) | `tools/lint-check/TOOL.md` |
| `policies` | `POLICY.md` (recursive) | `policies/security/POLICY.md` |
| `rules` | `*.md` (recursive) | `rules/code-style.md` |

## Build

```bash
bun run build         # Bundle + declarations
bun run typecheck     # Type-check only
```

Depends on `@ai-ext/schema` — build schema first if you've changed it.
