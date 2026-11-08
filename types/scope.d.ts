import type { JuliaNode, SyntaxElement, JuliaSourceCode } from './index.js';
export interface Binding {
  name: string;
  kind: string;
  scope?: Scope;
  builtin?: 'Base' | 'Core';
  constant?: boolean;
  definitions: Definition[];
  references: Reference[];
  writes: Definition[];
}
export interface Scope {
  kind: string;
  node: SyntaxElement;
  parent: Scope | null;
  module: Scope;
  children: Scope[];
  bindings: Map<string, Binding>;
  bareUsing: string[];
  dynamic: boolean;
}
export interface Definition {
  node: JuliaNode;
  name: string;
  scope: Scope;
  kind: string;
  binding: Binding;
  assignment?: JuliaNode;
  parameter?: JuliaNode;
  initialized?: boolean;
  typed?: boolean;
  constant?: boolean;
  opaque?: boolean;
}
export interface Reference {
  node: JuliaNode;
  name: string;
  scope: Scope;
  read: boolean;
  write: boolean;
  opaque?: boolean;
  binding: Binding | null;
}
export interface ScopeManager {
  scopes: Scope[];
  references: Reference[];
  definitions: Definition[];
  globalScope: Scope;
  functions: {
    node: JuliaNode;
    scope: Scope;
    arguments: Definition[];
    typeParameters: JuliaNode[];
    call: JuliaNode | null;
  }[];
  imports: Definition[];
  exports: { node: JuliaNode; name: string; scope: Scope }[];
  scopeFor(node: SyntaxElement): Scope | undefined;
  referenceFor(node: JuliaNode): Reference | undefined;
  definitionFor(node: JuliaNode): Definition | undefined;
  lookup(name: string, scope?: Scope): Binding | null;
  resolve(node: JuliaNode): Binding | null;
  isReadReference(node: JuliaNode): boolean;
  isUnshadowedBuiltin(node: JuliaNode, name: string): boolean;
}
export declare function getScopeManager(sourceCode: JuliaSourceCode): ScopeManager;
export declare function resolve(node: JuliaNode): Binding | null;
export declare function isReadReference(node: JuliaNode): boolean;
export declare function isUnshadowedBuiltin(node: JuliaNode, name: string): boolean;
export declare function identifierName(node: JuliaNode): string | null;
export declare function bindingNames(node: JuliaNode): JuliaNode[];
