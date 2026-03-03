/**
 * Container: wires relay context (useRelay) to VaultView. No UI changes; only state and handler mapping.
 * A1 Row (group, website, description, attributes[]) ↔ VaultEntry (group, url, description, attributes name/value/isSecret).
 */

import { useEffect, useMemo, useState } from "react";
import {
  VaultView,
  Stage,
  VaultAttribute,
  VaultEntry,
  PasswordGenConfig,
} from "@/components/VaultView";
import { useRelay } from "@/contexts/RelayContext";
import type { A1Row } from "@/lib/vault-types";

type C1Relay = ReturnType<typeof useRelay>;

interface VaultContainerProps {
  popupSize?: boolean;
  /** When true, container fills remaining space in a tabbed layout instead of fixed height. */
  embeddedInTabs?: boolean;
  /** When provided (e.g. from Index), use this relay instance so connection state is shared. */
  c1?: C1Relay;
  containerClassName?: string;
  onStorageChange?: (entries: VaultEntry[], stage: Stage) => void;
}

function a1RowToVaultEntry(r: A1Row, index: number): VaultEntry {
  return {
    id: r.id ?? `row-${r.group}-${r.website}-${index}`,
    group: r.group,
    url: r.website,
    description: r.description ?? "",
    attributes: (r.attributes ?? []).map((a) => ({
      name: a.key,
      value: typeof a.value === "string" ? a.value : String(a.value ?? ""),
      isSecret: a.isSecret ?? false,
    })),
  };
}

function relayFormToViewForm(
  form: ReturnType<typeof useRelay>["form"]
): {
  group: string;
  url: string;
  description: string;
  attributes: VaultAttribute[];
} {
  return {
    group: form.groupId,
    url: form.websiteUrl,
    description: form.description,
    attributes: form.attributes.map((a) => ({
      name: a.key,
      value: a.value,
      isSecret: a.isSecret ?? false,
    })),
  };
}

export function VaultContainer({
  popupSize = true,
  embeddedInTabs = false,
  c1: c1Prop,
  containerClassName = "",
  onStorageChange,
}: VaultContainerProps) {
  const c1FromHook = useRelay();
  const c1 = c1Prop ?? c1FromHook;

  const stage: Stage = c1.paired
    ? "connected"
    : c1.qrPayload
      ? "connecting"
      : "disconnected";

  const vaultEntries: VaultEntry[] = useMemo(
    () => c1.filteredRows.map((r, i) => a1RowToVaultEntry(r, i)),
    [c1.filteredRows]
  );

  const formData = useMemo(
    () => relayFormToViewForm(c1.form),
    [c1.form]
  );

  const qrData =
    c1.qrPayload?.url ??
    (c1.qrDataUrl ? c1.qrDataUrl.substring(0, 80) + "…" : "");
  const qrImageDataUrl = c1.qrDataUrl ?? undefined;

  const handleFormChange = (field: string, value: string) => {
    if (field === "group") c1.setForm((prev) => ({ ...prev, groupId: value }));
    else if (field === "url")
      c1.setForm((prev) => ({ ...prev, websiteUrl: value }));
    else if (field === "description")
      c1.setForm((prev) => ({ ...prev, description: value }));
  };

  const handleUpdateAttribute = (
    index: number,
    field: keyof VaultAttribute,
    value: string | boolean
  ) => {
    const key = field === "name" ? "key" : field;
    c1.setFormAttribute(index, key as "key" | "value" | "isSecret", value);
  };

  const handleSubmitEntry = () => {
    c1.saveRow();
  };

  const handleEditEntry = (entryId: string) => {
    const entry = vaultEntries.find((e) => e.id === entryId);
    if (!entry) return;
    // Only set editingId when this is a real A1 row id (numeric); otherwise save will create a new row.
    c1.setEditingId(/^\d+$/.test(entry.id) ? entry.id : null);
    c1.setForm({
      groupId: entry.group,
      websiteUrl: entry.url,
      description: entry.description,
      attributes:
        entry.attributes.length > 0
          ? entry.attributes.map((a) => ({
              key: a.name,
              value: a.value,
              isSecret: a.isSecret,
            }))
          : [{ key: "", value: "" }],
    });
  };

  const handleCopyToClipboard = (text: string) => {
    c1.copyValue(text);
  };

  const [passwordConfig, setPasswordConfig] = useState<PasswordGenConfig>({
    minLength: 8,
    maxLength: 24,
    minSpecialChars: 1,
    excludeChars: "",
    excludePattern: "",
    matchPattern: "",
  });
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showPasswordGen, setShowPasswordGen] = useState(false);
  const [activeSecretField, setActiveSecretField] = useState<{
    entryId?: string;
    attrIndex?: number;
  } | null>(null);

  const handlePasswordConfigChange = (field: string, value: unknown) => {
    setPasswordConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleGeneratePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const availableSpecial = specialChars
      .split("")
      .filter((c) => !passwordConfig.excludeChars.includes(c));
    const length =
      Math.floor(
        Math.random() * (passwordConfig.maxLength - passwordConfig.minLength + 1)
      ) + passwordConfig.minLength;
    let password = "";
    for (let i = 0; i < passwordConfig.minSpecialChars && availableSpecial.length; i++) {
      password += availableSpecial[Math.floor(Math.random() * availableSpecial.length)];
    }
    for (let i = password.length; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    setGeneratedPassword(
      password
        .split("")
        .sort(() => Math.random() - 0.5)
        .join("")
    );
  };

  const handleUseGeneratedPassword = () => {
    if (activeSecretField?.attrIndex !== undefined && generatedPassword) {
      handleUpdateAttribute(activeSecretField.attrIndex, "value", generatedPassword);
    }
    setShowPasswordGen(false);
    setActiveSecretField(null);
    setGeneratedPassword("");
  };

  useEffect(() => {
    onStorageChange?.(vaultEntries, stage);
  }, [vaultEntries, stage, onStorageChange]);

  // Clear clipboard when popup is closed or hidden (security: don't leave secrets in clipboard)
  useEffect(() => {
    const clear = () => c1.clearClipboardOnClose?.();
    window.addEventListener("pagehide", clear);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") clear();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", clear);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [c1.clearClipboardOnClose]);

  return (
    <VaultView
      stage={stage}
      vaultEntries={vaultEntries}
      searchQuery={c1.searchQuery}
      formData={formData}
      passwordConfig={passwordConfig}
      generatedPassword={generatedPassword}
      showPasswordGen={showPasswordGen}
      activeSecretField={activeSecretField}
      qrData={qrData}
      qrImageDataUrl={qrImageDataUrl}
      onConnect={c1.connect}
      onSearchChange={c1.setSearchQuery}
      onFormChange={handleFormChange}
      onAddAttribute={c1.addFormAttribute}
      onUpdateAttribute={handleUpdateAttribute}
      onRemoveAttribute={c1.removeFormAttribute}
      onSubmitEntry={handleSubmitEntry}
      onEditEntry={handleEditEntry}
      onPasswordConfigChange={handlePasswordConfigChange}
      onGeneratePassword={handleGeneratePassword}
      onUseGeneratedPassword={handleUseGeneratedPassword}
      onClosePasswordGen={() => {
        setShowPasswordGen(false);
        setActiveSecretField(null);
      }}
      onCopyToClipboard={handleCopyToClipboard}
      onPasswordGenOpen={(attrIndex) => {
        setActiveSecretField({ attrIndex });
        setShowPasswordGen(true);
      }}
      onRefresh={c1.refreshVault}
      popupSize={popupSize}
      embeddedInTabs={embeddedInTabs}
      containerClassName={containerClassName}
    />
  );
}

