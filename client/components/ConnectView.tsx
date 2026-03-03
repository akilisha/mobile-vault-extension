/**
 * Connect flow UI: receives relay state/callbacks from parent (no hook here).
 * Shown when extension is not yet connected; no tabs.
 */

import { ConnectScreen, type ConnectStage } from "@/components/ConnectScreen";

export interface ConnectViewProps {
  stage: ConnectStage;
  qrDataUrl: string | null;
  qrData: string;
  onConnect: () => void;
}

export function ConnectView({
  stage,
  qrDataUrl,
  qrData,
  onConnect,
}: ConnectViewProps) {
  return (
    <div className="h-extension w-samsung-s21 flex flex-col overflow-hidden bg-background">
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        <div className="w-samsung-s21 h-extension bg-card border border-border rounded-lg shadow-lg overflow-hidden flex flex-col">
          <ConnectScreen
            stage={stage}
            qrDataUrl={qrDataUrl}
            qrData={qrData}
            onConnect={onConnect}
          />
        </div>
      </div>
    </div>
  );
}
