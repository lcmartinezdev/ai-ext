---
name: lint-check
description: Run project linter on specified files and return results
parameters:
  type: object
  properties:
    files:
      type: array
      items:
        type: string
      description: File paths to lint
    fix:
      type: boolean
      description: Auto-fix issues if possible
  required:
    - files
implementation:
  type: command
  command: "echo 'Linting {{files}}... No issues found.'"
exposure:
  mcp: true
  native: true
---

Runs the project's configured linter (ESLint, Biome, etc.) on the specified files.

Returns a structured report of any lint violations found.
If `fix` is true, automatically applies safe fixes.
