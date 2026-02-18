# @ai-ext/schema — Agent Instructions

You are working in the `@ai-ext/schema` package. This is the **foundation** of the entire ai-ext platform. Every other package depends on the types and validators defined here.

## Responsibilities

- Define all canonical DSL types in `src/types.ts`
- Provide runtime validators in `src/validator.ts`
- Export everything cleanly from `src/index.ts`
- Maintain JSON Schema definitions in `schemas/`

## Critical Rules

1. **This is the single source of truth.** All extension component shapes are defined here. Never duplicate type definitions in other packages.
2. **Backwards compatibility matters.** Changing a type here affects every downstream package. Add new optional fields rather than changing existing required ones.
3. **Validators must match types.** If you add a field to a type, update the corresponding validator. If you add a new enum value, add it to the validator's constant array.
4. **Keep validators runtime-safe.** Validators receive `unknown` data and must handle malformed input gracefully. Never assume the shape of input data.

## File Guide

- `src/types.ts` — All TypeScript types. Organized by section: Common, Manifest, Skills, Agents, Hooks, Tools, Policies, IR, Compiler types.
- `src/validator.ts` — One `validate*` function per component type. Each returns `ValidationResult`.
- `src/index.ts` — Re-exports everything. Keep this in sync when adding new exports.
- `schemas/extension.schema.json` — JSON Schema for `extension.yaml`. Must stay in sync with `ExtensionManifest` type.

## Key Types

- `ExtensionIR` — The central data structure. A fully resolved, validated in-memory representation of an extension. The compiler consumes this.
- `TargetHost` — The union of supported compilation targets. Add new hosts here first.
- `HookEvent` — The canonical hook event names (superset across all hosts).
- `ComponentMetadata` — Shared metadata for all component types (name, description, license, tags).

## Adding a New Component Type

1. Define the interface in `src/types.ts` (follow the pattern of existing components)
2. Add it to `ExtensionIR`
3. Add a validator in `src/validator.ts`
4. Export from `src/index.ts`

## Build

This package must be built before downstream packages can typecheck:

```bash
bun run build   # Generates dist/ with declarations
```
