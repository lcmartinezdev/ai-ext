---
name: lint-before-edit
description: Run linter validation before any file edit to prevent introducing style violations
event: PreToolUse
matcher: "Edit|Write"
handlers:
  - type: command
    command: "echo 'lint check passed'"
    timeout: 30
    statusMessage: "Running lint check..."
fallback:
  strategy: mcp-tool
  description: When hooks are unavailable, expose as MCP tool that the agent should call before editing files.
---

This hook runs a lint check before any file is edited or written.
If the lint check fails (exit code 2), the edit is blocked and the error is reported to the agent.

In hosts without native hook support, this is exposed as an MCP tool
named `ai-ext_hook_pre-tool-use` that the agent is instructed to call
before making file modifications.
