/**
 * @ai-ext/core — Extension Loader
 *
 * Loads and parses the canonical extension format:
 * - extension.yaml (manifest)
 * - SKILL.md, AGENT.md, HOOK.md, TOOL.md, POLICY.md files
 *   (markdown with YAML frontmatter)
 * - rules/*.md (plain markdown)
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { parse as parseYaml } from "yaml";
import matter from "gray-matter";
import type { ExtensionManifest } from "@ai-ext/schema";
import { needsYamlQuotes, ensureYamlQuotes } from "@ai-ext/schema";

// ---------------------------------------------------------------------------
// Frontmatter Parsing
// ---------------------------------------------------------------------------

export interface ParsedComponent<T = Record<string, unknown>> {
  /** Parsed YAML frontmatter */
  frontmatter: T;
  /** Markdown body content */
  body: string;
  /** Source file path */
  sourcePath: string;
}

/**
 * Fix YAML descriptions that need quoting in raw frontmatter.
 * This scans the raw frontmatter for unquoted descriptions and adds quotes.
 */
function fixYamlDescriptionsInFrontmatter(
  rawContent: string
): string {
  // Match description: value (where value is not quoted)
  // This regex finds description fields that aren't already quoted
  const descriptionPattern = /^(description:\s*)(\S.*)$/gm;

  const result = rawContent.replace(
    descriptionPattern,
    (match, prefix, value) => {
      // Skip if already quoted
      if (value.trim().startsWith('"') || value.trim().startsWith("'")) {
        return match;
      }

      // Check if this description needs quotes
      if (needsYamlQuotes(value)) {
        const fixedValue = ensureYamlQuotes(value);
        return `${prefix}${fixedValue}`;
      }

      return match;
    }
  );

  return result;
}

/**
 * Parse a markdown file with YAML frontmatter.
 * Returns the parsed frontmatter and the markdown body.
 */
export function parseMarkdownFile(
  filePath: string,
  options?: { fixYamlDescriptions?: boolean }
): ParsedComponent {
  let raw = readFileSync(filePath, "utf-8");
  let contentToParse = raw;

  // Auto-fix YAML descriptions if enabled
  if (options?.fixYamlDescriptions) {
    const fixed = fixYamlDescriptionsInFrontmatter(raw);
    if (fixed !== raw) {
      writeFileSync(filePath, fixed, "utf-8");
      contentToParse = fixed;
    }
  }

  const { data, content } = matter(contentToParse);

  return {
    frontmatter: data as Record<string, unknown>,
    body: content.trim(),
    sourcePath: filePath,
  };
}

// ---------------------------------------------------------------------------
// Manifest Loading
// ---------------------------------------------------------------------------

/**
 * Load and parse extension.yaml from a directory.
 * Looks for extension.yaml or extension.yml.
 */
export function loadManifest(dir: string): ExtensionManifest {
  const yamlPath = resolve(dir, "extension.yaml");
  const ymlPath = resolve(dir, "extension.yml");

  let manifestPath: string;
  if (existsSync(yamlPath)) {
    manifestPath = yamlPath;
  } else if (existsSync(ymlPath)) {
    manifestPath = ymlPath;
  } else {
    throw new Error(
      `No extension.yaml found in ${dir}. Run 'ai-ext init' to create one.`
    );
  }

  const raw = readFileSync(manifestPath, "utf-8");
  const parsed = parseYaml(raw) as ExtensionManifest;

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid extension manifest at ${manifestPath}`);
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Component Discovery
// ---------------------------------------------------------------------------

/**
 * Discover component files in a directory.
 * Looks for files matching the given filename pattern.
 */
export function discoverComponents(
  baseDir: string,
  componentDir: string | undefined,
  filename: string
): string[] {
  if (!componentDir) return [];

  const dir = resolve(baseDir, componentDir);
  if (!existsSync(dir)) return [];

  const results: string[] = [];
  scanDirectory(dir, filename, results);
  return results.sort();
}

/**
 * Recursively scan a directory for files matching a name.
 */
function scanDirectory(dir: string, filename: string, results: string[]): void {
  // Use Bun.js or Node fs to read directory
  const { readdirSync, statSync } = require("node:fs");
  const entries = readdirSync(dir) as string[];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath, filename, results);
    } else if (
      entry === filename ||
      entry.toUpperCase() === filename.toUpperCase()
    ) {
      results.push(fullPath);
    }
  }
}

/**
 * Discover rule files (plain markdown) in a directory.
 */
export function discoverRules(
  baseDir: string,
  rulesDir: string | undefined
): Map<string, string> {
  const rules = new Map<string, string>();
  if (!rulesDir) return rules;

  const dir = resolve(baseDir, rulesDir);
  if (!existsSync(dir)) return rules;

  const { readdirSync, statSync } = require("node:fs");
  scanRules(dir, dir, rules);
  return rules;
}

function scanRules(
  rootDir: string,
  currentDir: string,
  rules: Map<string, string>
): void {
  const { readdirSync, statSync } = require("node:fs");
  const entries = readdirSync(currentDir) as string[];

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      scanRules(rootDir, fullPath, rules);
    } else if (entry.endsWith(".md")) {
      const relativePath = fullPath.slice(rootDir.length + 1);
      const content = readFileSync(fullPath, "utf-8");
      rules.set(relativePath, content);
    }
  }
}
