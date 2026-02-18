# ai-ext Roadmap

## Vision

ai-ext is a **Universal AI Agent Extension Platform** — a portable AI operating layer that abstracts away the fragmentation across AI coding environments. It enables developers to define skills, agents, hooks, tools, and policies once, then deploy them to any supported host.

The long-term goal: hosts become execution shells. ai-ext becomes the intelligence layer.

---

## Phase 1 — Foundation (Complete)

The canonical DSL, compiler, and runtime core.

### Delivered

- [x] **Canonical DSL specification** — Markdown + YAML frontmatter format extending the Agent Skills open standard. Six component types: Skills, Agents, Hooks, Tools, Policies, Rules.
- [x] **Type system** (`@ai-ext/schema`) — Full TypeScript types for all components, `ExtensionIR` intermediate representation, runtime validators, JSON Schema for extension manifest.
- [x] **Extension loader and parser** (`@ai-ext/core`) — YAML + frontmatter parsing, recursive component discovery, Agent Skills spec compatibility (handles both canonical and spec-native field names), full IR resolution pipeline.
- [x] **Multi-target compiler** (`@ai-ext/compiler`) — Three target adapters:
  - **Claude Code** — Native skills, subagents, hooks (14 events), permissions, MCP config
  - **KiloCode** — Skills, Custom Modes, workflows, rule instructions, MCP config (hooks via runtime bridge)
  - **OpenCode** — Skills, agents, commands, TypeScript plugin generation for hooks, native tool generation with Zod schemas, opencode.json
- [x] **Runtime MCP server** (`@ai-ext/runtime`) — Tool routing, hook emulation engine (command handlers), session + project memory store, MCP resources.
- [x] **CLI** (`@ai-ext/cli`) — `ai-ext init`, `ai-ext validate`, `ai-ext build --target`, `ai-ext serve`. Supports multi-target builds, dry-run previews, verbose output, configurable output directories.
- [x] **Example extension** — Exercises all 6 component types with a code-review skill, reviewer agent, lint hook, lint-check tool, security policy, and code-style rules.
- [x] **Documentation** — Root README, AGENTS.md for every package, per-package READMEs.

---

## Phase 2 — Hardening & Runtime Depth

Testing, developer experience, and completing the runtime layer.

### 2.1 — Developer Experience

- [ ] **`ai-ext dev` watch mode** — File watcher that auto-recompiles on source changes. Rebuild only the affected target(s). Hot-reload the runtime MCP server.
- [ ] **Better CLI output** — Colored output with `chalk`, progress spinners with `ora`, structured error formatting with source file/line references.
- [ ] **Extension templates** — `ai-ext init --template <name>` with built-in templates: `minimal`, `full`, `team-standards`, `security-policy`.
- [ ] **YAML serialization improvement** — Replace naive string concatenation in emitters with proper `yaml` library serialization for correct quoting and escaping.

### 2.2 — Test Suite

- [ ] **Unit tests** — Validators, parsers, each emitter function. Use Bun's built-in test runner.
- [ ] **Integration tests** — Full resolve + compile pipeline for each target. Snapshot tests comparing generated output.
- [ ] **E2E tests** — `ai-ext init` -> `ai-ext validate` -> `ai-ext build` -> verify output files exist and are valid for each host.
- [ ] **CI pipeline** — GitHub Actions for typecheck, test, build on every PR.

### 2.3 — Hook Engine Completion

- [ ] **Prompt handler type** — Hook handlers that send a prompt to an LLM for single-turn yes/no evaluation. Requires an LLM client integration (Anthropic SDK or provider-agnostic).
- [ ] **Agent handler type** — Hook handlers that spawn a subagent with tool access to verify conditions. More complex than prompt type — needs tool routing within the hook execution.
- [ ] **Hook composition** — Multiple handlers per hook executing in sequence with short-circuit on deny.
- [ ] **Async hooks** — Background hook execution that doesn't block the main agent flow.

### 2.4 — Memory Layer

- [ ] **User scope** — Memory persisted at `~/.ai-ext/memory.json`, shared across all projects.
- [ ] **Memory namespacing** — Partition memory by extension name to prevent collisions when multiple extensions share a runtime.
- [ ] **TTL / expiry** — Optional time-to-live for memory entries.
- [ ] **Vector storage** (optional) — Embedding-based memory for semantic retrieval. Likely using a lightweight embedded database (SQLite with vector extension or similar).

### 2.5 — Sub-Agent Orchestration Engine

- [ ] **Planner** — Accept a high-level goal, decompose into subtasks, assign to agents.
- [ ] **Executor** — Run agents with tool access, capture results.
- [ ] **Reflection loop** — After execution, evaluate results and decide whether to retry, escalate, or complete.
- [ ] **Delegation graph** — Track which agent delegated to which, with dependency ordering.
- [ ] **Retry logic** — Configurable retry strategies per agent (exponential backoff, fallback agent, human escalation).

---

## Phase 3 — Ecosystem & Distribution

Extension sharing, marketplace, and broader host coverage.

### 3.1 — Extension Registry

- [ ] **Package format** — Define how extensions are packaged for distribution (tarball, npm, git).
- [ ] **`ai-ext publish`** — CLI command to publish an extension to a registry.
- [ ] **`ai-ext install`** — CLI command to install an extension from a registry.
- [ ] **Version resolution** — Semantic versioning, dependency resolution between extensions.
- [ ] **Registry server** — HTTP API for publishing, searching, and downloading extensions.

### 3.2 — Extension Marketplace

- [ ] **Web UI** — Browse, search, and preview extensions.
- [ ] **Quality scoring** — Automated checks (validation, target coverage, documentation).
- [ ] **Community contributions** — Public submissions with review process.
- [ ] **Organization scoping** — Private registries for enterprise teams.

### 3.3 — Additional Target Hosts

- [ ] **Cursor** — `.cursorrules`, limited plugin API. Primarily rules + skills via `.cursor/` directory.
- [ ] **Windsurf (Codeium)** — Rules format, Cascade agent configuration.
- [ ] **Continue.dev** — Open-source, `config.json` based. Good target for full-feature support.
- [ ] **Zed** — Via ACP (Agent Client Protocol). OpenCode already supports ACP, so this may layer naturally.
- [ ] **JetBrains AI** — JetBrains IDE AI assistant integration points.

### 3.4 — Compiler Enhancements

- [ ] **Incremental compilation** — Only recompile components that changed.
- [ ] **Source maps** — Track which canonical source produced which output file/line for debugging.
- [ ] **Multi-extension composition** — Merge multiple extensions into a single output (e.g., team base + project-specific).
- [ ] **Conflict detection** — Warn when multiple extensions define overlapping permissions, hooks, or tool names.

---

## Phase 4 — Enterprise & Advanced

Enterprise features, governance, and advanced runtime capabilities.

### 4.1 — Enterprise Policy Management

- [ ] **Managed policies** — Organization-wide policies that cannot be overridden by project-level extensions.
- [ ] **Policy inheritance** — Policies compose: org > team > project, with merge rules.
- [ ] **Audit logging** — Track which hooks fired, which tools were called, which permissions were granted/denied.
- [ ] **Compliance templates** — Pre-built policy packs for SOC2, HIPAA, GDPR-relevant constraints.

### 4.2 — Advanced Runtime

- [ ] **HTTP transport** — MCP server on HTTP in addition to stdio, enabling remote/shared runtime instances.
- [ ] **Multi-session support** — Single runtime serving multiple concurrent agent sessions.
- [ ] **Agent teams** — Coordinated multi-agent execution with shared task lists, messaging, and quality gates.
- [ ] **Execution telemetry** — Metrics on tool usage, hook execution times, memory access patterns.

### 4.3 — IDE Integration

- [ ] **VS Code extension** — GUI for browsing installed extensions, viewing compilation output, managing targets.
- [ ] **Language server** — LSP for `extension.yaml`, SKILL.md, AGENT.md frontmatter (autocomplete, validation, hover docs).
- [ ] **Debug adapter** — Step through hook execution, inspect memory state, trace tool routing.

---

## Non-Goals (Current Scope)

These are explicitly out of scope for the foreseeable future:

- **Replacing host-native plugin systems** — ai-ext complements, not replaces, native extension mechanisms.
- **Runtime model inference** — ai-ext does not run LLMs. It orchestrates agents that run on host-provided models.
- **Cross-host real-time synchronization** — Extensions compile to each host independently. There is no live sync between a Claude Code session and a KiloCode session.
- **GUI-first authoring** — The canonical format is text files (Markdown + YAML). A GUI may come later but is not a priority.

---

## Contributing

The roadmap is maintained in `docs/ROADMAP.md`. To propose changes:

1. Open an issue describing the feature or change
2. Reference the relevant phase and section
3. Include a brief rationale for why it belongs at that phase

Priority within phases is roughly top-to-bottom, but may shift based on user feedback and contributor interest.
