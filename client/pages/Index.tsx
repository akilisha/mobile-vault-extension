import { useRelay } from "@/contexts/RelayContext";
import { useExtensionMachine } from "@/hooks/useExtensionMachine";
import { ConnectView } from "@/components/ConnectView";
import { PopupTabs } from "@/components/PopupTabs";
import { VaultContainer } from "@/components/VaultContainer";
import { CaptureTabShell } from "@/components/CaptureTabShell";
import { Button } from "@/components/ui/button";

export default function Index() {
  const c1 = useRelay();
  const { ext, dispatch } = useExtensionMachine(c1.paired, !!c1.qrPayload);

  const handleActivate = () => {
    if (typeof chrome !== "undefined" && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId != null) dispatch({ type: "CAPTURE_ACTIVATE", payload: { tabId } });
      });
    }
  };

  const handleDeactivate = () => {
    dispatch({ type: "CAPTURE_DEACTIVATE" });
  };

  if (ext.showConnectView) {
    const qrData =
      c1.qrPayload?.url ??
      (c1.qrDataUrl ? c1.qrDataUrl.substring(0, 80) + "…" : "");
    return (
      <ConnectView
        stage={ext.connectStage}
        qrDataUrl={c1.qrDataUrl}
        qrData={qrData}
        onConnect={c1.connect}
      />
    );
  }

  return (
    <div className="h-extension w-samsung-s21 flex flex-col overflow-hidden bg-background">
      {c1.paired && (
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 border-b border-border bg-card">
          <span className="text-xs text-muted-foreground">Connected</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => c1.disconnect()}
          >
            Disconnect
          </Button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col">
        <PopupTabs
          captureContent={
          <CaptureTabShell
            active={ext.captureActiveForUI}
            onActivate={handleActivate}
            onDeactivate={handleDeactivate}
          />
        }
        vaultContent={
          <VaultContainer popupSize={true} embeddedInTabs={true} c1={c1} />
        }
        vaultTabDisabled={ext.captureActiveForUI}
        />
      </div>
    </div>
  );
}
