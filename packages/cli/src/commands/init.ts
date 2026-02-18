/**
 * ai-ext init — Initialize a new extension project
 *
 * Creates:
 *   extension.yaml
 *   skills/
 *   agents/
 *   hooks/
 *   tools/
 *   policies/
 *   rules/
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface InitOptions {
  /** Directory to initialize in */
  dir: string;
  /** Extension name */
  name?: string;
}

const MANIFEST_TEMPLATE = (name: string) => `name: ${name}
version: 0.1.0
description: A portable AI agent extension
author: ""
license: MIT

skills: ./skills/
agents: ./agents/
hooks: ./hooks/
tools: ./tools/
policies: ./policies/
rules: ./rules/
`;

const EXAMPLE_SKILL = `---
name: example
description: An example skill that demonstrates the ai-ext canonical format
allowed-tools: Read Grep Glob
---

You are a helpful assistant with access to the project codebase.

When asked to help, use the available tools to read and search files.

Provide clear, concise answers with file references.
`;

const EXAMPLE_RULE = `# Project Rules

## Code Style
- Use consistent formatting
- Write clear comments
- Follow the project's existing conventions
`;

export function initExtension(options: InitOptions): void {
  const { dir, name } = options;
  const extensionName = name || dir.split("/").pop() || "my-extension";

  // Check if already initialized
  const manifestPath = join(dir, "extension.yaml");
  if (existsSync(manifestPath)) {
    throw new Error(
      `Extension already exists at ${dir}. Delete extension.yaml to reinitialize.`
    );
  }

  // Create directories
  const dirs = ["skills/example", "agents", "hooks", "tools", "policies", "rules"];
  for (const d of dirs) {
    mkdirSync(join(dir, d), { recursive: true });
  }

  // Write manifest
  writeFileSync(manifestPath, MANIFEST_TEMPLATE(extensionName), "utf-8");

  // Write example skill
  writeFileSync(
    join(dir, "skills/example/SKILL.md"),
    EXAMPLE_SKILL,
    "utf-8"
  );

  // Write example rule
  writeFileSync(
    join(dir, "rules/project-rules.md"),
    EXAMPLE_RULE,
    "utf-8"
  );
}
