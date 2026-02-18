# ai-ext

**Universal AI Agent Extension Platform** — portable skills, agents, hooks, and tools across AI coding environments.

## The Problem

AI coding tools are fragmented. Each has its own plugin format, skill system, hook capabilities, and tool handling. Developers must duplicate behavior across environments. There is no standard for skills, agents, hooks, tools, policies, or execution lifecycle.

## The Solution

ai-ext is a cross-agent runtime platform that includes:

1. **Canonical Extension DSL** — A host-agnostic specification using Markdown + YAML frontmatter (extending the [Agent Skills](https://agentskills.io) open standard)
2. **Multi-Target Compiler** — Compile once, deploy to Claude Code, KiloCode, OpenCode, and more
3. **Cross-Agent Runtime Layer** — MCP-compatible server providing hook emulation, tool routing, and memory for hosts that lack native support
4. **Portable Agent Orchestration** — Define agents, permissions, and workflows that work identically everywhere

## Supported Targets

| Host | Skills | Agents | Hooks | Tools | Policies |
|------|--------|--------|-------|-------|----------|
| **Claude Code** | Native SKILL.md | Native subagents | Native hooks (14 events) | MCP server | Native permissions |
| **KiloCode** | Native SKILL.md | Custom Modes | Runtime bridge (MCP) | MCP server | Rule instructions |
| **OpenCode** | Native SKILL.md | Native agents | Plugin-based | Native tools + MCP | Agent-level permissions |

## Quick Start

### Install

```bash
# Clone the repo
git clone https://github.com/lcmartinezdev/ai-ext.git
cd ai-ext

# Install dependencies (requires Bun >= 1.0)
bun install
```

### Initialize an Extension

```bash
bun packages/cli/src/cli.ts init -d my-extension -n my-team-standards
```

This creates:

```
my-extension/
  extension.yaml          # Manifest
  skills/example/SKILL.md # Example skill
  agents/                 # Agent definitions
  hooks/                  # Hook definitions
  tools/                  # Tool definitions
  policies/               # Policy definitions
  rules/project-rules.md  # Rule files
```

### Validate

```bash
bun packages/cli/src/cli.ts validate -d my-extension
```

### Build for a Target Host

```bash
# Single target
bun packages/cli/src/cli.ts build --target claude -d my-extension

# Multiple targets
bun packages/cli/src/cli.ts build --target claude kilocode opencode -d my-extension

# Preview without writing
bun packages/cli/src/cli.ts build --target claude -d my-extension --dry-run -v
```

### Start the Runtime Server

```bash
bun packages/cli/src/cli.ts serve -d my-extension
```

## Canonical Extension Format

Extensions are authored as Markdown files with YAML frontmatter, extending the Agent Skills spec.

### extension.yaml (Manifest)

```yaml
name: my-team-standards
version: 1.0.0
description: Team coding standards and workflows
author: acme-corp
license: MIT

skills: ./skills/
agents: ./agents/
hooks: ./hooks/
tools: ./tools/
policies: ./policies/
rules: ./rules/
```

### Skills (`skills/<name>/SKILL.md`)

```yaml
---
name: code-review
description: Performs thorough code review
argument-hint: "[file-or-directory]"
allowed-tools: Read Grep Glob
context: fork
agent: Explore
---

Review instructions in markdown...
```

### Agents (`agents/<name>/AGENT.md`)

```yaml
---
name: reviewer
description: Expert code reviewer
model: sonnet
maxTurns: 50
tools:
  allowed: [Read, Grep, Glob, Bash]
  disallowed: [Write, Edit]
permissionMode: default
memory: project
---

Agent instructions in markdown...
```

### Hooks (`hooks/<name>/HOOK.md`)

```yaml
---
name: lint-before-edit
description: Run linter before file edits
event: PreToolUse
matcher: "Edit|Write"
handlers:
  - type: command
    command: "./scripts/lint-check.sh"
    timeout: 30
fallback:
  strategy: mcp-tool
---

Hook description...
```

### Tools (`tools/<name>/TOOL.md`)

```yaml
---
name: lint-check
description: Run project linter on specified files
parameters:
  type: object
  properties:
    files:
      type: array
      items: { type: string }
  required: [files]
implementation:
  type: command
  command: "npx eslint {{files}}"
exposure:
  mcp: true
  native: true
---

Tool description...
```

### Policies (`policies/<name>/POLICY.md`)

```yaml
---
name: security-baseline
description: Security constraints for all agents
permissions:
  deny:
    - "Bash(rm -rf *)"
    - "Read(.env)"
  ask:
    - "Bash(git push *)"
  allow:
    - "Read(src/**)"
    - "Bash(npm test)"
sandbox:
  enabled: true
  network:
    allowedDomains: ["github.com", "*.npmjs.org"]
---

Policy rationale...
```

### Rules (`rules/*.md`)

Plain markdown files with project instructions. Compiled to `CLAUDE.md`, `AGENTS.md`, or host-specific rule directories.

## Architecture

```
extension.yaml (manifest)
    |
    v
  Loader / Parser (@ai-ext/core)
    |
    v
  Validated IR (Intermediate Representation)
    |
    v
  Compiler (@ai-ext/compiler)
    |
    +---> Claude Code target  --> .claude/, .mcp.json, CLAUDE.md
    +---> KiloCode target     --> .kilocode/, .kilocodemodes, AGENTS.md
    +---> OpenCode target     --> .opencode/, opencode.json, AGENTS.md
    |
    v
  Runtime MCP Server (@ai-ext/runtime)
    |
    +---> Tool routing (canonical tools exposed via MCP)
    +---> Hook emulation (for hosts without native hooks)
    +---> Memory store (session + project persistence)
```

## Package Structure

| Package | Description |
|---------|-------------|
| `@ai-ext/schema` | Canonical DSL types, JSON Schema, validation |
| `@ai-ext/core` | Extension loader, parser, IR resolver |
| `@ai-ext/compiler` | Multi-target compiler with Claude, KiloCode, OpenCode adapters |
| `@ai-ext/runtime` | MCP server, hook engine, memory store |
| `@ai-ext/cli` | CLI tool (`ai-ext init/validate/build/serve`) |

## How Compilation Works

The compiler reads the canonical format and generates host-native files:

| Canonical Component | Claude Code Output | KiloCode Output | OpenCode Output |
|--------------------|--------------------|-----------------|-----------------|
| Skill | `.claude/skills/<name>/SKILL.md` | `.kilocode/skills/<name>/SKILL.md` + workflow | `.opencode/skills/<name>/SKILL.md` + command |
| Agent | `.claude/agents/<name>.md` | `.kilocodemodes` (Custom Mode) | `.opencode/agents/<name>.md` |
| Hook | `.claude/settings.json` hooks section | Runtime MCP bridge | `.opencode/plugins/ai-ext-hooks.ts` |
| Tool | `.mcp.json` (runtime server) | `.kilocode/mcp.json` (runtime server) | `.opencode/tools/<name>.ts` + `opencode.json` |
| Policy | `.claude/settings.json` permissions | `.kilocode/rules/policy-*.md` | Agent-level permission config |
| Rules | `CLAUDE.md` + `.claude/rules/` | `AGENTS.md` + `.kilocode/rules/` | `AGENTS.md` |

When a host lacks native support for a feature, the compiler injects a runtime bridge (typically via MCP server reference).

## Development

```bash
# Install dependencies
bun install

# Typecheck all packages
bun run --filter '*' typecheck

# Build all packages
bun run --filter '*' build

# Run the CLI directly
bun packages/cli/src/cli.ts <command>
```

## Roadmap

### Phase 1 (Current)
- [x] Canonical DSL specification
- [x] Extension loader, parser, validator
- [x] Compiler with Claude Code, KiloCode, OpenCode targets
- [x] Runtime MCP server with tool routing, hook emulation, memory
- [x] CLI (`init`, `validate`, `build`, `serve`)
- [x] Example extension

### Phase 2
- [ ] `ai-ext dev` watch mode
- [ ] Unit and e2e test suite
- [ ] Hook engine: `prompt` and `agent` handler types
- [ ] Memory layer: vector storage
- [ ] Sub-agent orchestration engine

### Phase 3
- [ ] Extension registry and package distribution
- [ ] Versioned extension marketplace
- [ ] Additional host targets (Cursor, Windsurf, Continue.dev)

## License

MIT
