/**
 * Minimal vault types for E1/W1. A1 schema: row = metadata + attributes[].
 */

/** One attribute in an A1 row. */
export interface A1Attribute {
  key: string;
  value: string;
  isSecret?: boolean;
}

/** One row as returned by A1 (readAll) or sent in save payload. */
export interface A1Row {
  id?: string;
  group: string;
  website: string;
  description: string;
  attributes: A1Attribute[];
}

/** Flat row shape (one per attribute) for listing/remove. */
export interface FlatRow {
  groupId: string;
  websiteUrl: string;
  description: string;
  key: string;
  value: unknown;
}

export type Params = Record<string, unknown>;
export type SelectResult = Record<string, unknown>[];
