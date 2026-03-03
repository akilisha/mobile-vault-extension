/**
 * Relay engine for background service worker.
 * WebSocket, pairing, ClientVault, and relay state. No React, no QR image (popup generates qrDataUrl from qrPayload).
 * Notify via onChange when state changes so the background can push to the popup.
 */

import { ClientVault } from "./ClientVault";
import type { A1Row } from "./vault-types";
import {
  generateKeyPair,
  exportPublicKeyBase64,
  importPublicKeyBase64,
  deriveSharedSecret,
  deriveEncryptionKey,
  encrypt,
  decrypt,
  isConnectionRequest,
  isConnectionAcknowledged,
} from "./relay-crypto";

const CONNECT_TIMEOUT_MS = 10_000;

export type StatusKind = "normal" | "error" | "paired";

export interface RelayFormAttribute {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface RelayEngineState {
  relayUrl: string;
  status: { text: string; kind: StatusKind };
  qrPayload: { r1id: string; url: string } | null;
  paired: boolean;
  rows: A1Row[];
  loading: "idle" | "refresh" | "save";
  form: {
    groupId: string;
    websiteUrl: string;
    description: string;
    attributes: RelayFormAttribute[];
  };
  connectDisabled: boolean;
  loadingRemove: string | null;
  editingId: string | null;
}

const DEFAULT_FORM: RelayEngineState["form"] = {
  groupId: "",
  websiteUrl: "",
  description: "",
  attributes: [{ key: "", value: "" }],
};

function normalizeToA1Rows(raw: unknown): A1Row[] {
  if (!Array.isArray(raw)) return [];
  const out: A1Row[] = [];
  for (const r of raw) {
    const obj = r as Record<string, unknown>;
    const group = String(obj.groupId ?? obj.group ?? "");
    const website = String(obj.websiteUrl ?? obj.website ?? "");
    const description = String(obj.description ?? "");
    const attrs = obj.attributes;
    const attributes = Array.isArray(attrs)
      ? (attrs as unknown[]).map((a: unknown) => {
          const x = a as Record<string, unknown>;
          return {
            key: typeof x?.key === "string" ? x.key : "",
            value:
              typeof x?.value === "string"
                ? x.value
                : String(x?.value ?? ""),
            isSecret: Boolean(x?.isSecret),
          };
        })
      : [];
    out.push({
      id: obj.id != null ? String(obj.id) : undefined,
      group,
      website,
      description,
      attributes,
    });
  }
  return out;
}

export type RelayEngineOnChange = (state: RelayEngineState) => void;

export class RelayEngine {
  private state: RelayEngineState;
  private onChange: RelayEngineOnChange;
  private ws: WebSocket | null = null;
  private clientVault: ClientVault | null = null;
  private keypair: CryptoKeyPair | null = null;
  private peerPublicKey: CryptoKey | null = null;
  private encryptionKey: CryptoKey | null = null;
  private wasPaired = false;
  private disconnectReason: string | null = null;
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    initialRelayUrl: string,
    onChange: RelayEngineOnChange
  ) {
    this.state = {
      relayUrl: initialRelayUrl,
      status: { text: "", kind: "normal" },
      qrPayload: null,
      paired: false,
      rows: [],
      loading: "idle",
      form: { ...DEFAULT_FORM },
      connectDisabled: false,
      loadingRemove: null,
      editingId: null,
    };
    this.onChange = onChange;
  }

  getState(): RelayEngineState {
    return { ...this.state };
  }

  private setState(partial: Partial<RelayEngineState>): void {
    this.state = { ...this.state, ...partial };
    this.onChange(this.getState());
  }

  setRelayUrl(relayUrl: string): void {
    this.setState({ relayUrl });
  }

  setForm(form: RelayEngineState["form"]): void {
    this.setState({ form });
  }

  setEditingId(editingId: string | null): void {
    this.setState({ editingId });
  }

  connect(url: string): void {
    const base = (url || this.state.relayUrl).trim();
    if (!base) {
      this.setState({
        status: { text: "Enter relay URL", kind: "error" },
      });
      return;
    }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.setState({ status: { text: "Already connected", kind: "normal" } });
      return;
    }
    const wsUrl = base.includes("?") ? `${base}&role=c1` : `${base}?role=c1`;
    this.setState({
      status: { text: "Connecting…", kind: "normal" },
      qrPayload: null,
      paired: false,
      connectDisabled: true,
    });
    this.clientVault = null;
    this.disconnectReason = null;

    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    this.connectTimeoutId = setTimeout(() => {
      this.connectTimeoutId = null;
      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.ws?.close();
        this.ws = null;
        this.setState({
          connectDisabled: false,
          status: {
            text: "Connection failed: timeout. Check relay URL and network.",
            kind: "error",
          },
        });
      }
    }, CONNECT_TIMEOUT_MS);

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.connectTimeoutId) {
        clearTimeout(this.connectTimeoutId);
        this.connectTimeoutId = null;
      }
      this.setState({ status: { text: "Waiting for device to scan QR…", kind: "normal" } });
    };

    ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(event);
    };

    ws.onclose = () => {
      if (this.connectTimeoutId) {
        clearTimeout(this.connectTimeoutId);
        this.connectTimeoutId = null;
      }
      const reason = this.disconnectReason;
      this.disconnectReason = null;
      this.ws = null;
      this.clientVault = null;
      this.keypair = null;
      this.peerPublicKey = null;
      this.encryptionKey = null;
      const wasPaired = this.wasPaired;
      this.wasPaired = false;
      this.setState({
        connectDisabled: false,
        paired: false,
        qrPayload: null,
        status: {
          text:
            reason ||
            (wasPaired
              ? "Disconnected. Connect again to show a new QR and re-pair."
              : "Pairing expired or disconnected. Connect again to re-pair."),
          kind: "error",
        },
      });
    };

    ws.onerror = () => {
      this.setState({
        connectDisabled: false,
        status: {
          text: "Connection error. Check relay URL and network.",
          kind: "error",
        },
      });
    };
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    let data: string;
    if (typeof event.data === "string") {
      data = event.data;
    } else if (event.data instanceof Blob) {
      data = await event.data.text();
    } else {
      return;
    }
    let msg: { r1id?: string; url?: string; type?: string };
    try {
      msg = JSON.parse(data);
    } catch {
      this.clientVault?.handleReply(data);
      return;
    }
    if (msg.r1id && msg.url && !msg.type) {
      this.setState({ qrPayload: { r1id: msg.r1id, url: msg.url } });
      return;
    }
    if (msg.type === "paired") {
      const sendEnc = (s: string) => {
        if (this.ws?.readyState !== WebSocket.OPEN) return;
        const key = this.encryptionKey;
        if (key) {
          encrypt(s, key).then((enc) => this.ws?.send(enc));
        } else {
          this.ws?.send(s);
        }
      };
      this.clientVault = new ClientVault(sendEnc);
      this.wasPaired = true;
      this.setState({
        paired: true,
        qrPayload: null,
        status: { text: "Paired — handshaking…", kind: "paired" },
      });
      return;
    }
    if (isConnectionRequest(msg)) {
      try {
        const peerKey = await importPublicKeyBase64(msg.publicKey);
        this.peerPublicKey = peerKey;
        const keypair = await generateKeyPair();
        this.keypair = keypair;
        const publicKeyB64 = await exportPublicKeyBase64(keypair.publicKey);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({ type: "connection-accepted", publicKey: publicKeyB64 })
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.setState({ status: { text: "Handshake failed: " + message, kind: "error" } });
      }
      return;
    }
    if (isConnectionAcknowledged(msg)) {
      try {
        const keypair = this.keypair;
        const peerKey = this.peerPublicKey;
        if (!keypair || !peerKey) {
          this.setState({ status: { text: "Handshake out of order", kind: "error" } });
          return;
        }
        const sharedSecret = await deriveSharedSecret(keypair.privateKey, peerKey);
        const encKey = await deriveEncryptionKey(sharedSecret);
        this.encryptionKey = encKey;
        this.setState({ status: { text: "Paired", kind: "paired" } });
        this.refreshVault();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        this.setState({ status: { text: "Handshake failed: " + message, kind: "error" } });
      }
      return;
    }
    let replyData = data;
    if (
      msg &&
      typeof msg === "object" &&
      "iv" in msg &&
      "data" in msg &&
      this.encryptionKey
    ) {
      try {
        replyData = await decrypt(data, this.encryptionKey);
      } catch {
        this.disconnectReason =
          "Connection closed: invalid or tampered message. Reconnect to re-pair.";
        this.ws?.close();
        return;
      }
    }
    this.clientVault?.handleReply(replyData);
  }

  disconnect(): void {
    if (this.connectTimeoutId) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    this.ws?.close();
    this.ws = null;
    this.clientVault = null;
    this.keypair = null;
    this.peerPublicKey = null;
    this.encryptionKey = null;
    this.wasPaired = false;
    this.setState({
      paired: false,
      qrPayload: null,
      connectDisabled: false,
      status: { text: "Disconnected", kind: "normal" },
    });
  }

  async refreshVault(): Promise<void> {
    const cv = this.clientVault;
    if (!cv) return;
    this.setState({ loading: "refresh", status: { text: "Loading…", kind: "normal" } });
    try {
      const raw = await cv.readAll();
      const all = normalizeToA1Rows(raw);
      this.setState({
        rows: all,
        loading: "idle",
        status: { text: `Paired · ${all.length} row(s)`, kind: "paired" },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isVaultNotOpen =
        message.includes("Vault not open") || message.includes("vault_not_open");
      this.setState({
        rows: [],
        loading: "idle",
        status: {
          text: "Device: " + message,
          kind: isVaultNotOpen ? "normal" : "error",
        },
      });
    }
  }

  async saveRow(): Promise<void> {
    const cv = this.clientVault;
    if (!cv) return;
    const { form, editingId } = this.state;
    const groupId = form.groupId.trim();
    const attributes = form.attributes
      .map((a) => ({
        key: a.key.trim(),
        value: a.value.trim(),
        isSecret: a.isSecret,
      }))
      .filter((a) => a.key.length > 0);
    if (!groupId) {
      this.setState({ status: { text: "Group required", kind: "error" } });
      return;
    }
    if (attributes.length === 0) {
      this.setState({
        status: { text: "Add at least one attribute (key)", kind: "error" },
      });
      return;
    }
    this.setState({ loading: "save", status: { text: "Saving…", kind: "normal" } });
    try {
      await cv.save({
        groupId,
        websiteUrl: form.websiteUrl.trim(),
        description: form.description.trim(),
        attributes,
        ...(editingId != null && editingId !== "" ? { id: editingId } : {}),
      });
      this.setState({
        status: { text: "Paired", kind: "paired" },
        editingId: null,
        form: { ...form, attributes: [{ key: "", value: "" }], description: "" },
      });
      await this.refreshVault();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isVaultNotOpen =
        message.includes("Vault not open") || message.includes("vault_not_open");
      this.setState({
        loading: "idle",
        status: {
          text: "Device: " + message,
          kind: isVaultNotOpen ? "normal" : "error",
        },
      });
      return;
    }
    this.setState({ loading: "idle" });
  }

  async removeRow(groupId: string, key: string): Promise<void> {
    const cv = this.clientVault;
    if (!cv) return;
    const id = `${groupId}:${key}`;
    this.setState({ loadingRemove: id });
    try {
      await cv.remove(groupId, key);
      await this.refreshVault();
    } catch (e) {
      this.setState({
        status: {
          text: "Device: " + (e instanceof Error ? e.message : String(e)),
          kind: "error",
        },
      });
    } finally {
      this.setState({ loadingRemove: null });
    }
  }
}
