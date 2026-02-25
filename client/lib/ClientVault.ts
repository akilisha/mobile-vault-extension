/**
 * ClientVault: vault operations over the relay to A1.
 * E1/W1 send save/readAll/remove; A1 executes against local vault.
 */

import type { A1Row } from "./vault-types";

export interface SaveRowPayload {
  groupId: string;
  websiteUrl: string;
  description: string;
  attributes: { key: string; value: string; isSecret?: boolean }[];
}

interface VaultRequest {
  id: string;
  type: "save" | "readAll" | "read" | "update" | "remove" | "clear" | "execute" | "select";
  payload?: Record<string, unknown>;
}

interface VaultReplySuccess {
  id: string;
  result: unknown;
}

interface VaultReplyError {
  id: string;
  error: true;
  code: string;
  message?: string;
}

type VaultReply =
  | VaultReplySuccess
  | VaultReplyError
  | { id: string; error: string };

function isVaultReply(obj: unknown): obj is VaultReply {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    typeof (obj as VaultReply).id === "string"
  );
}

function isStructuredError(obj: VaultReply): obj is VaultReplyError {
  return "error" in obj && obj.error === true && "code" in obj;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

export class ClientVault {
  private send: (data: string) => void;
  private pending = new Map<string, Pending>();

  constructor(send: (data: string) => void) {
    this.send = send;
  }

  handleReply(data: string): void {
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!isVaultReply(msg)) return;
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    this.pending.delete(msg.id);
    if (isStructuredError(msg)) {
      const text = msg.message ? `${msg.code}: ${msg.message}` : msg.code;
      entry.reject(new Error(text));
    } else if ("error" in msg && msg.error !== undefined) {
      entry.reject(new Error(String(msg.error)));
    } else {
      entry.resolve((msg as VaultReplySuccess).result);
    }
  }

  private request<T>(
    type: VaultRequest["type"],
    payload?: Record<string, unknown>
  ): Promise<T> {
    const id = crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
      });
      this.send(JSON.stringify({ id, type, payload: payload ?? {} }));
    });
  }

  save(value: SaveRowPayload): Promise<boolean> {
    return this.request("save", {
      groupId: value.groupId,
      websiteUrl: value.websiteUrl,
      description: value.description,
      attributes: value.attributes,
    });
  }

  readAll(): Promise<A1Row[]> {
    return this.request<A1Row[]>("readAll", {});
  }

  remove(group: string, key: string): Promise<boolean> {
    return this.request("remove", { group, key });
  }
}
