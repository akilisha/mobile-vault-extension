/**
 * Stateless connect UI: disconnected (Connect button) and connecting (QR).
 * Single source of truth for the connect flow; used when not yet connected.
 */

import { Button } from "@/components/ui/button";
import { MobileVaultLogo } from "@/components/MobileVaultLogo";

export type ConnectStage = "disconnected" | "connecting";

export interface ConnectScreenProps {
  stage: ConnectStage;
  qrDataUrl: string | null;
  qrData: string;
  onConnect: () => void;
}

export function ConnectScreen({
  stage,
  qrDataUrl,
  qrData,
  onConnect,
}: ConnectScreenProps) {
  if (stage === "disconnected") {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center justify-center h-full space-y-8">
          <div className="flex items-center space-x-3">
            <MobileVaultLogo size={48} />
            <h1 className="text-2xl font-bold text-foreground">Mobile Vault</h1>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-security-red rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Disconnected</span>
          </div>
          <Button
            onClick={onConnect}
            className="w-32 h-12 bg-security-blue hover:bg-security-blue/90"
          >
            Connect
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="flex flex-col items-center justify-center h-full space-y-6">
        <div className="flex items-center space-x-3">
          <MobileVaultLogo size={32} />
          <h2 className="text-lg font-semibold">Connecting...</h2>
        </div>
        <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan with your device to connect"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="grid grid-cols-8 gap-1 w-40 h-40">
              {Array.from({ length: 64 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 ${Math.random() > 0.5 ? "bg-black" : "bg-white"}`}
                />
              ))}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Scan this QR code with your mobile device to establish a secure
          connection
        </p>
        <div className="text-xs text-muted-foreground font-mono">
          {qrData.substring(0, 20)}...
        </div>
      </div>
    </div>
  );
}
