import { useC1Relay } from "@/hooks/useC1Relay";
import { ConnectView } from "@/components/ConnectView";
import { PopupTabs } from "@/components/PopupTabs";
import { VaultContainer } from "@/components/VaultContainer";
import { CaptureTabShell } from "@/components/CaptureTabShell";

export default function Index() {
  const c1 = useC1Relay();

  if (!c1.paired) {
    const stage = c1.qrPayload ? "connecting" : "disconnected";
    const qrData =
      c1.qrPayload?.url ??
      (c1.qrDataUrl ? c1.qrDataUrl.substring(0, 80) + "…" : "");
    return (
      <ConnectView
        stage={stage}
        qrDataUrl={c1.qrDataUrl}
        qrData={qrData}
        onConnect={c1.connect}
      />
    );
  }

  return (
    <PopupTabs
      captureContent={<CaptureTabShell />}
      vaultContent={
        <VaultContainer popupSize={true} embeddedInTabs={true} c1={c1} />
      }
    />
  );
}
