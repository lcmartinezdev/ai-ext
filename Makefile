# Makefile for ai-ext (Universal AI Agent Extension Platform)
#
# Requires: bun >= 1.0.0

.PHONY: help install build test lint typecheck clean validate serve ext

# Default target
help:
	@echo "ai-ext Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  install    Install all dependencies"
	@echo "  build      Build all packages"
	@echo "  ext        Build extension (T=target, D=dir, O=out-dir)"
	@echo "  test       Run all tests"
	@echo "  lint       Lint all packages"
	@echo "  typecheck  Type-check all packages"
	@echo "  clean      Clean build artifacts"
	@echo "  validate   Validate example extension"
	@echo "  serve      Start runtime MCP server"

# Install dependencies
install:
	bun install

# Build all packages
build:
	bun run build

# Run all tests
test:
	bun run test

# Lint all packages
lint:
	bun run lint

# Type-check all packages
typecheck:
	bun run typecheck

# Clean build artifacts
clean:
	bun run clean

# Validate example extension
validate:
	@bun packages/cli/src/cli.ts validate --dir extensions/example

# Validate with auto-fix
validate-fix:
	@bun packages/cli/src/cli.ts validate --dir extensions/example --fix

# Build extension for a specific target
# Usage: make ext T=kilocode                  # Build example for kilocode
#        make ext T=kilocode D=~/my-ext       # Custom source dir
#        make ext T=kilocode D=~/my-ext O=~/output  # With output dir
#        make ext T=kilocode F=1              # Auto-fix YAML descriptions
ext:
	@bun packages/cli/src/cli.ts build --target $(if $(T),$(T),claude kilocode opencode) $(if $(D),-d $(D),-d extensions/example) $(if $(O),-o $(O)) $(if $(F),--fix)

# Start runtime MCP server
serve:
	@bun packages/cli/src/cli.ts serve --dir extensions/example
