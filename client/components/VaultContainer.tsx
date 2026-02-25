import { useState, useEffect } from "react";
import {
  VaultView,
  Stage,
  VaultAttribute,
  VaultEntry,
  PasswordGenConfig,
} from "@/components/VaultView";

interface VaultContainerProps {
  popupSize?: boolean;
  containerClassName?: string;
  onStorageChange?: (entries: VaultEntry[], stage: Stage) => void;
}

export function VaultContainer({
  popupSize = true,
  containerClassName = "",
  onStorageChange,
}: VaultContainerProps) {
  const [stage, setStage] = useState<Stage>("disconnected");
  const [vaultEntries, setVaultEntries] = useState<VaultEntry[]>([
    {
      id: "1",
      group: "Email",
      url: "https://gmail.com",
      description: "Primary email account",
      attributes: [
        { name: "email", value: "user@gmail.com", isSecret: false },
        { name: "password", value: "SecurePass123!", isSecret: true },
      ],
    },
    {
      id: "2",
      group: "Banking",
      url: "https://bank.example.com",
      description: "Main bank account",
      attributes: [
        { name: "account_number", value: "****1234", isSecret: true },
        { name: "pin", value: "1234", isSecret: true },
        { name: "username", value: "john_doe", isSecret: false },
      ],
    },
    {
      id: "3",
      group: "GitHub",
      url: "https://github.com",
      description: "Developer account",
      attributes: [
        { name: "username", value: "johndoe", isSecret: false },
        { name: "personal_access_token", value: "ghp_xyz123abc", isSecret: true },
      ],
    },
    {
      id: "4",
      group: "AWS",
      url: "https://aws.amazon.com",
      description: "Cloud infrastructure",
      attributes: [
        { name: "access_key_id", value: "AKIAIOSFODNN7EXAMPLE", isSecret: true },
        {
          name: "secret_access_key",
          value: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
          isSecret: true,
        },
        { name: "region", value: "us-east-1", isSecret: false },
      ],
    },
    {
      id: "5",
      group: "Slack",
      url: "https://slack.com",
      description: "Team workspace",
      attributes: [
        { name: "workspace_url", value: "mycompany.slack.com", isSecret: false },
        {
          name: "api_token",
          value: "xoxb-1234567890-1234567890",
          isSecret: true,
        },
      ],
    },
  ]);

  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [showPasswordGen, setShowPasswordGen] = useState(false);
  const [activeSecretField, setActiveSecretField] = useState<{
    entryId?: string;
    attrIndex?: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    group: "",
    url: "",
    description: "",
    attributes: [{ name: "", value: "", isSecret: false }] as VaultAttribute[],
  });

  // Password generator state
  const [passwordConfig, setPasswordConfig] = useState<PasswordGenConfig>({
    minLength: 8,
    maxLength: 24,
    minSpecialChars: 1,
    excludeChars: "",
    excludePattern: "",
    matchPattern: "",
  });
  const [generatedPassword, setGeneratedPassword] = useState("");

  // QR Code data
  const qrData = `${Math.random().toString(36).substring(2, 15)},https://vault-server.example.com`;

  // Load vault data from Chrome storage on mount
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(
        ["vaultEntries", "connectionStatus"],
        (result) => {
          if (result.vaultEntries && result.vaultEntries.length > 0) {
            setVaultEntries(result.vaultEntries);
          }
          if (result.connectionStatus) {
            setStage(result.connectionStatus as Stage);
          }
        }
      );
    }
  }, []);

  // Save vault entries to Chrome storage whenever they change
  useEffect(() => {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      vaultEntries.length > 0
    ) {
      chrome.storage.local.set({ vaultEntries });
    }
    onStorageChange?.(vaultEntries, stage);
  }, [vaultEntries, onStorageChange, stage]);

  // Save connection status to Chrome storage whenever it changes
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.set({ connectionStatus: stage });
    }
  }, [stage]);

  const handleConnect = () => {
    setStage("connecting");
    setTimeout(() => {
      setStage("connected");
    }, 2000);
  };

  const handleAddAttribute = () => {
    setFormData((prev) => ({
      ...prev,
      attributes: [...prev.attributes, { name: "", value: "", isSecret: false }],
    }));
  };

  const handleUpdateAttribute = (
    index: number,
    field: keyof VaultAttribute,
    value: string | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      attributes: prev.attributes.map((attr, i) =>
        i === index ? { ...attr, [field]: value } : attr
      ),
    }));
  };

  const handleRemoveAttribute = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index),
    }));
  };

  const handleGeneratePassword = () => {
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    const availableSpecial = specialChars
      .split("")
      .filter((char) => !passwordConfig.excludeChars.includes(char));

    const length =
      Math.floor(
        Math.random() * (passwordConfig.maxLength - passwordConfig.minLength + 1)
      ) + passwordConfig.minLength;
    let password = "";

    // Add required special characters
    for (
      let i = 0;
      i < passwordConfig.minSpecialChars && i < availableSpecial.length;
      i++
    ) {
      password +=
        availableSpecial[Math.floor(Math.random() * availableSpecial.length)];
    }

    // Fill the rest with regular characters
    for (let i = password.length; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }

    // Shuffle the password
    password = password.split("").sort(() => Math.random() - 0.5).join("");
    setGeneratedPassword(password);
  };

  const handleUseGeneratedPassword = () => {
    if (activeSecretField && generatedPassword) {
      if (activeSecretField.attrIndex !== undefined) {
        handleUpdateAttribute(activeSecretField.attrIndex, "value", generatedPassword);
      }
      setShowPasswordGen(false);
      setActiveSecretField(null);
      setGeneratedPassword("");
    }
  };

  const handleSubmitEntry = () => {
    const newEntry: VaultEntry = {
      id: Math.random().toString(36).substring(2, 15),
      ...formData,
    };

    setVaultEntries((prev) => [...prev, newEntry]);
    setFormData({
      group: "",
      url: "",
      description: "",
      attributes: [{ name: "", value: "", isSecret: false }],
    });
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePasswordConfigChange = (field: string, value: any) => {
    setPasswordConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePasswordGenOpen = (attrIndex: number) => {
    setActiveSecretField({ attrIndex });
    setShowPasswordGen(true);
  };

  return (
    <VaultView
      stage={stage}
      vaultEntries={vaultEntries}
      searchQuery={searchQuery}
      formData={formData}
      passwordConfig={passwordConfig}
      generatedPassword={generatedPassword}
      showPasswordGen={showPasswordGen}
      activeSecretField={activeSecretField}
      qrData={qrData}
      onConnect={handleConnect}
      onSearchChange={setSearchQuery}
      onFormChange={handleFormChange}
      onAddAttribute={handleAddAttribute}
      onUpdateAttribute={handleUpdateAttribute}
      onRemoveAttribute={handleRemoveAttribute}
      onSubmitEntry={handleSubmitEntry}
      onEditEntry={setEditingEntry}
      onPasswordConfigChange={handlePasswordConfigChange}
      onGeneratePassword={handleGeneratePassword}
      onUseGeneratedPassword={handleUseGeneratedPassword}
      onClosePasswordGen={() => {
        setShowPasswordGen(false);
        setActiveSecretField(null);
      }}
      onCopyToClipboard={handleCopyToClipboard}
      onPasswordGenOpen={handlePasswordGenOpen}
      popupSize={popupSize}
      containerClassName={containerClassName}
    />
  );
}
