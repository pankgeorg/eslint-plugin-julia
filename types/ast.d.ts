/** AST contract v1. All source ranges are half-open UTF-16 unless named byteRange. */
export interface Position { readonly line: number; readonly column: number }
export interface Location { readonly start: Position; readonly end: Position }
export type Range = readonly [number, number];
export interface JuliaFile {
  readonly type: 'JuliaFile';
  readonly kind: 'JuliaFile';
  readonly children: readonly JuliaNode[];
  readonly range: Range;
  readonly byteRange: Range;
  readonly loc: Location;
}
export interface JuliaNode {
  readonly type: string;
  readonly kind: string;
  readonly interior: boolean;
  readonly children: readonly JuliaNode[];
  readonly range: Range;
  readonly byteRange: Range;
  readonly loc: Location;
  readonly value?: string;
  readonly originalKind?: string;
  /** Unstable grammar-specific fields. */
  readonly kindId: number;
  readonly originalKindId?: number;
  readonly flags: number;
  readonly class: number;
}
export type SyntaxElement = JuliaFile | JuliaNode;
export interface ParentLookup { getParent(node: SyntaxElement): SyntaxElement | undefined }
export function isInfixCall(node: JuliaNode): boolean;
export function isPrefixCall(node: JuliaNode): boolean;
export function isPrefixOperatorCall(node: JuliaNode): boolean;
export function isMutableStruct(node: JuliaNode): boolean;
export function isTripleString(node: JuliaNode): boolean;
export function isShortFunction(node: JuliaNode): boolean;
export function hasTrailingComma(node: JuliaNode): boolean;
export function semanticChildren(node: SyntaxElement): readonly JuliaNode[];
export function getOperatorToken(node: JuliaNode): JuliaNode | undefined;
export function isInsideMacro(node: SyntaxElement, source: ParentLookup): boolean;
export function isQuoted(node: SyntaxElement, source: ParentLookup): boolean;
