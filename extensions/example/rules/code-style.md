# Code Style Rules

## TypeScript
- Use `const` by default, `let` only when reassignment is needed
- Prefer explicit return types on exported functions
- Use `interface` for object shapes, `type` for unions/intersections
- No `any` — use `unknown` and narrow with type guards

## Naming
- camelCase for variables and functions
- PascalCase for types, interfaces, and classes
- SCREAMING_SNAKE_CASE for constants
- kebab-case for file names

## Formatting
- 2 space indentation
- Semicolons required
- Single quotes for strings
- Trailing commas in multiline expressions
