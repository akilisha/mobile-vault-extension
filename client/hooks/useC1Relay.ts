/**
 * E1/W1 relay behaviour: WebSocket, pairing, vault over relay.
 * No UI; only state and actions for VaultContainer to map to VaultView.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ClientVault } from "@/lib/ClientVault";
import type { A1Row } from "@/lib/vault-types";
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
} from "@/lib/relay-crypto";

const CONNECT_TIMEOUT_MS = 10_000;

// Same as old extension: VITE_RELAY_URL from env, else ws://localhost:3000/ws
const BUILD_RELAY_URL = (() => {
  const raw = import.meta.env.VITE_RELAY_URL || "ws://localhost:3000/ws";
  const base = String(raw).replace(/\/+$/, "");
  return base.endsWith("/ws") ? base : `${base}/ws`;
})();

export type StatusKind = "normal" | "error" | "paired";

export interface RelayFormAttribute {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface C1RelayState {
  relayUrl: string;
  status: { text: string; kind: StatusKind };
  qrPayload: { r1id: string; url: string } | null;
  qrDataUrl: string | null;
  paired: boolean;
  /** A1-shaped rows from readAll (one row = one vault entry). */
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
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredRows: A1Row[];
  /** Set when editing an existing row so save sends update instead of create. */
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

export interface C1RelayActions {
  setRelayUrl: (url: string) => void;
  connect: () => void;
  refreshVault: () => void;
  saveRow: () => void;
  removeRow: (groupId: string, key: string) => void;
  copyValue: (value: unknown) => void;
  /** Call when popup is closing or hidden; clears clipboard if we had copied a secret (security). */
  clearClipboardOnClose: () => void;
  setForm: React.Dispatch<React.SetStateAction<C1RelayState["form"]>>;
  setFormAttribute: (
    index: number,
    field: "key" | "value" | "isSecret",
    value: string | boolean
  ) => void;
  addFormAttribute: () => void;
  removeFormAttribute: (index: number) => void;
}

function isVaultReply(data: string): boolean {
  try {
    const msg = JSON.parse(data) as {
      id?: string;
      result?: unknown;
      error?: string;
    };
    return (
      typeof msg === "object" &&
      msg !== null &&
      typeof msg.id === "string" &&
      ("result" in msg || "error" in msg)
    );
  } catch {
    return false;
  }
}

/** Normalize readAll result to A1 rows (array of { id?, group, website, description, attributes[] }). */
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
    out.push({ id: obj.id != null ? String(obj.id) : undefined, group, website, description, attributes });
  }
  return out;
}

export function useC1Relay(): C1RelayState & C1RelayActions {
  const [relayUrl, setRelayUrl] = useState(BUILD_RELAY_URL);
  const [status, setStatusState] = useState<C1RelayState["status"]>({
    text: "",
    kind: "normal",
  });
  const [qrPayload, setQrPayload] = useState<C1RelayState["qrPayload"]>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [rows, setRows] = useState<A1Row[]>([]);
  const [loading, setLoading] = useState<C1RelayState["loading"]>("idle");
  const [form, setForm] = useState<C1RelayState["form"]>({
    groupId: "",
    websiteUrl: "",
    description: "",
    attributes: [{ key: "", value: "" }],
  });
  const [connectDisabled, setConnectDisabled] = useState(false);
  const [loadingRemove, setLoadingRemove] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const clientVaultRef = useRef<ClientVault | null>(null);
  const wasPairedRef = useRef(false);
  const keypairRef = useRef<CryptoKeyPair | null>(null);
  const peerPublicKeyRef = useRef<CryptoKey | null>(null);
  const encryptionKeyRef = useRef<CryptoKey | null>(null);
  const disconnectReasonRef = useRef<string | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadCopiedSecretRef = useRef(false);

  const setStatus = useCallback((text: string, kind: StatusKind = "normal") => {
    setStatusState({ text, kind });
  }, []);

  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl(null);
      return;
    }
    const str = JSON.stringify(qrPayload);
    QRCode.toDataURL(str, { width: 200, margin: 1 })
      .then(setQrDataUrl)
      .catch((err) =>
        setStatus(
          "QR failed: " + (err instanceof Error ? err.message : String(err)),
          "error"
        )
      );
  }, [qrPayload, setStatus]);

  const refreshVault = useCallback(async () => {
    const cv = clientVaultRef.current;
    if (!cv) return;
    setLoading("refresh");
    setStatus("Loading…");
    try {
      const raw = await cv.readAll();
      const all = normalizeToA1Rows(raw);
      setRows(all);
      setStatus(`Paired · ${all.length} row(s)`, "paired");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isVaultNotOpen =
        message.includes("Vault not open") || message.includes("vault_not_open");
      setStatus("Device: " + message, isVaultNotOpen ? "normal" : "error");
      setRows([]);
    } finally {
      setLoading("idle");
    }
  }, [setStatus]);

  const saveRow = useCallback(async () => {
    const cv = clientVaultRef.current;
    if (!cv) return;
    const groupId = form.groupId.trim();
    const attributes = form.attributes
      .map((a) => ({
        key: a.key.trim(),
        value: a.value.trim(),
        isSecret: a.isSecret,
      }))
      .filter((a) => a.key.length > 0);
    if (!groupId) {
      setStatus("Group required", "error");
      return;
    }
    if (attributes.length === 0) {
      setStatus("Add at least one attribute (key)", "error");
      return;
    }
    setLoading("save");
    setStatus("Saving…");
    try {
      await cv.save({
        groupId,
        websiteUrl: form.websiteUrl.trim(),
        description: form.description.trim(),
        attributes,
        ...(editingId != null && editingId !== "" ? { id: editingId } : {}),
      });
      setStatus("Paired", "paired");
      setEditingId(null);
      setForm((f) => ({ ...f, attributes: [{ key: "", value: "" }], description: "" }));
      await refreshVault();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const isVaultNotOpen =
        message.includes("Vault not open") || message.includes("vault_not_open");
      setStatus("Device: " + message, isVaultNotOpen ? "normal" : "error");
    } finally {
      setLoading("idle");
    }
  }, [form, editingId, setStatus, refreshVault]);

  const removeRow = useCallback(
    async (groupId: string, key: string) => {
      const cv = clientVaultRef.current;
      if (!cv) return;
      const id = `${groupId}:${key}`;
      setLoadingRemove(id);
      try {
        await cv.remove(groupId, key);
        await refreshVault();
      } catch (e) {
        setStatus(
          "Device: " + (e instanceof Error ? e.message : String(e)),
          "error"
        );
      } finally {
        setLoadingRemove(null);
      }
    },
    [setStatus, refreshVault]
  );

  const copyValue = useCallback((value: unknown) => {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    navigator.clipboard.writeText(str).then(
      () => {
        hadCopiedSecretRef.current = true;
        setStatus("Copied to clipboard", "paired");
      },
      () => setStatus("Copy failed", "error")
    );
  }, [setStatus]);

  const clearClipboardOnClose = useCallback(() => {
    if (!hadCopiedSecretRef.current) return;
    hadCopiedSecretRef.current = false;
    navigator.clipboard.writeText("").catch(() => {});
  }, []);

  const setFormAttribute = useCallback(
    (
      index: number,
      field: "key" | "value" | "isSecret",
      value: string | boolean
    ) => {
      setForm((prev) => {
        const next = [...prev.attributes];
        if (index < 0 || index >= next.length) return prev;
        next[index] = { ...next[index], [field]: value };
        return { ...prev, attributes: next };
      });
    },
    []
  );

  const addFormAttribute = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      attributes: [...prev.attributes, { key: "", value: "" }],
    }));
  }, []);

  const removeFormAttribute = useCallback((index: number) => {
    setForm((prev) => {
      if (prev.attributes.length <= 1) return prev;
      const next = prev.attributes.filter((_, i) => i !== index);
      return { ...prev, attributes: next };
    });
  }, []);

  const connect = useCallback(() => {
    const base = relayUrl.trim();
    if (!base) {
      setStatus("Enter relay URL", "error");
      return;
    }
    const url = base.includes("?") ? `${base}&role=c1` : `${base}?role=c1`;
    setStatus("Connecting…");
    setQrPayload(null);
    setPaired(false);
    clientVaultRef.current = null;
    setConnectDisabled(true);

    if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    connectTimeoutRef.current = setTimeout(() => {
      connectTimeoutRef.current = null;
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        wsRef.current?.close();
        wsRef.current = null;
        setConnectDisabled(false);
        setStatus(
          "Connection failed: timeout. Check relay URL and network.",
          "error"
        );
      }
    }, CONNECT_TIMEOUT_MS);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setStatus("Waiting for device to scan QR…");
    };

    ws.onmessage = async (event: MessageEvent) => {
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
        clientVaultRef.current?.handleReply(data);
        return;
      }
      if (msg.r1id && msg.url && !msg.type) {
        setQrPayload({ r1id: msg.r1id, url: msg.url });
        return;
      }
      if (msg.type === "paired") {
        const sendEnc = (s: string) => {
          if (wsRef.current?.readyState !== WebSocket.OPEN) return;
          const key = encryptionKeyRef.current;
          if (key) encrypt(s, key).then((enc) => wsRef.current?.send(enc));
          else wsRef.current?.send(s);
        };
        const cv = new ClientVault(sendEnc);
        clientVaultRef.current = cv;
        wasPairedRef.current = true;
        setPaired(true);
        setQrPayload(null);
        setStatus("Paired — handshaking…", "paired");
        return;
      }
      if (isConnectionRequest(msg)) {
        try {
          const peerKey = await importPublicKeyBase64(msg.publicKey);
          peerPublicKeyRef.current = peerKey;
          const keypair = await generateKeyPair();
          keypairRef.current = keypair;
          const publicKeyB64 = await exportPublicKeyBase64(keypair.publicKey);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: "connection-accepted", publicKey: publicKeyB64 })
            );
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          setStatus("Handshake failed: " + message, "error");
        }
        return;
      }
      if (isConnectionAcknowledged(msg)) {
        try {
          const keypair = keypairRef.current;
          const peerKey = peerPublicKeyRef.current;
          if (!keypair || !peerKey) {
            setStatus("Handshake out of order", "error");
            return;
          }
          const sharedSecret = await deriveSharedSecret(
            keypair.privateKey,
            peerKey
          );
          const encKey = await deriveEncryptionKey(sharedSecret);
          encryptionKeyRef.current = encKey;
          setStatus("Paired", "paired");
          refreshVault();
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          setStatus("Handshake failed: " + message, "error");
        }
        return;
      }
      let replyData = data;
      if (
        msg &&
        typeof msg === "object" &&
        "iv" in msg &&
        "data" in msg &&
        encryptionKeyRef.current
      ) {
        try {
          replyData = await decrypt(data, encryptionKeyRef.current);
        } catch {
          disconnectReasonRef.current =
            "Connection closed: invalid or tampered message. Reconnect to re-pair.";
          wsRef.current?.close();
          return;
        }
      }
      clientVaultRef.current?.handleReply(replyData);
    };

    ws.onclose = () => {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      const wasPaired = wasPairedRef.current;
      const reason = disconnectReasonRef.current;
      disconnectReasonRef.current = null;
      wsRef.current = null;
      clientVaultRef.current = null;
      keypairRef.current = null;
      peerPublicKeyRef.current = null;
      encryptionKeyRef.current = null;
      wasPairedRef.current = false;
      setConnectDisabled(false);
      setPaired(false);
      setQrPayload(null);
      setStatus(
        reason ||
          (wasPaired
            ? "Disconnected. Connect again to show a new QR and re-pair."
            : "Pairing expired or disconnected. Connect again to re-pair."),
        "error"
      );
      if (wasPaired) {
        setTimeout(() => connect(), 0);
      }
    };

    ws.onerror = () => {
      setConnectDisabled(false);
      setStatus("Connection error. Check relay URL and network.", "error");
    };
  }, [relayUrl, setStatus, refreshVault]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.group).toLowerCase().includes(q) ||
        String(r.website).toLowerCase().includes(q) ||
        String(r.description).toLowerCase().includes(q) ||
        (r.attributes ?? []).some(
          (a) =>
            String(a.key).toLowerCase().includes(q) ||
            String(a.value).toLowerCase().includes(q)
        )
    );
  }, [rows, searchQuery]);

  useEffect(
    () => () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      wsRef.current?.close();
    },
    []
  );

  return {
    relayUrl,
    status,
    qrPayload,
    qrDataUrl,
    paired,
    rows,
    loading,
    form,
    connectDisabled,
    loadingRemove,
    searchQuery,
    setSearchQuery,
    filteredRows,
    editingId,
    setEditingId,
    setRelayUrl,
    connect,
    refreshVault,
    saveRow,
    removeRow,
    copyValue,
    setForm,
    setFormAttribute,
    addFormAttribute,
    removeFormAttribute,
    clearClipboardOnClose,
  };
}
