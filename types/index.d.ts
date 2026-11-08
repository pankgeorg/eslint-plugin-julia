import type { ESLint, Linter } from 'eslint';
import { TextSourceCodeBase } from '@eslint/plugin-kit';
import type { VisitNodeStep } from '@eslint/plugin-kit';
import type { JuliaFile, JuliaNode, SyntaxElement, Range, Location } from './ast.js';
export type { JuliaFile, JuliaNode, SyntaxElement, Range, Location } from './ast.js';
export interface JuliaLanguageOptions extends Record<string, unknown> {
  recover?: boolean;
}
export interface PreferIdentityNothingOptions {
  fix?: boolean;
}
export interface NoEmptyCatchOptions {
  allowComment?: boolean;
}
export interface Diagnostic {
  readonly message: string;
  readonly level: number;
  readonly range: Range;
  readonly byteRange: Range;
  readonly loc: Location;
}
export interface ParserProvenance {
  readonly schemaVersion: number;
  readonly sha256: string;
  readonly bytes: number;
  readonly versions: Readonly<Record<string, string>>;
  readonly sources: Readonly<Record<string, string>>;
  readonly abi: { readonly version: number; readonly exports: readonly string[] };
}
export interface JuliaParseResult {
  ast: JuliaFile;
  tokens: JuliaNode[];
  comments: JuliaNode[];
  diagnostics: Diagnostic[];
  visitorKeys: Record<string, string[]>;
  parents: WeakMap<SyntaxElement, SyntaxElement>;
  provenance: ParserProvenance;
  rawCount: number;
  bytes: number;
}
export declare class JuliaSourceCode extends TextSourceCodeBase<{
  LangOptions: JuliaLanguageOptions;
  RootNode: JuliaFile;
  SyntaxElementWithLoc: SyntaxElement;
  ConfigNode: JuliaNode;
}> {
  constructor(text: string, result: JuliaParseResult);
  readonly tokens: readonly JuliaNode[];
  readonly comments: readonly JuliaNode[];
  readonly diagnostics: readonly Diagnostic[];
  readonly provenance: ParserProvenance;
  readonly visitorKeys: Record<string, string[]>;
  getParent(node: SyntaxElement): SyntaxElement | undefined;
  getTokenBefore(node: { range: Range }, options?: { includeComments?: boolean }): JuliaNode | null;
  getTokenAfter(node: { range: Range }, options?: { includeComments?: boolean }): JuliaNode | null;
  traverse(): Generator<VisitNodeStep>;
  commentValue(comment: JuliaNode): string;
}
declare const plugin: ESLint.Plugin & {
  meta: { name: 'eslint-plugin-julia'; version: string };
  languages: NonNullable<ESLint.Plugin['languages']>;
  rules: NonNullable<ESLint.Plugin['rules']>;
  configs: { recommended: Linter.Config; style: Linter.Config; all: Linter.Config };
};
export default plugin;
