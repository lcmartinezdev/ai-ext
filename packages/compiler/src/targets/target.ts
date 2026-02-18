/**
 * @ai-ext/compiler — Target Interface
 *
 * Every compilation target implements this interface.
 * The compiler orchestrates: IR → Target.compile() → files.
 */

import type {
  ExtensionIR,
  BuildResult,
  BuildWarning,
  RuntimeRequirement,
  TargetHost,
} from "@ai-ext/schema";

/**
 * A compilation target generates host-specific files from the canonical IR.
 */
export interface CompilationTarget {
  /** Target identifier */
  readonly name: TargetHost;

  /** Human-readable display name */
  readonly displayName: string;

  /**
   * Compile the extension IR into host-specific files.
   *
   * @param ir - The fully resolved extension IR
   * @returns Map of relative file paths to file contents
   */
  compile(ir: ExtensionIR): TargetOutput;
}

/**
 * Output from a compilation target.
 */
export interface TargetOutput {
  /** Generated files (relative path → content) */
  files: Map<string, string>;

  /** Warnings emitted during compilation */
  warnings: BuildWarning[];

  /** Features that require the runtime layer */
  runtimeRequirements: RuntimeRequirement[];
}
