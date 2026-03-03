/**
 * Tab layout: Capture (default) | Vault. When Capture is active (watching), Vault tab is disabled
 * until user Deactivates — avoids juggling two "active" concepts: only Capture has explicit
 * Activate/Deactivate; Vault is always "session persists" when connected.
 */

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface PopupTabsProps {
  captureContent: ReactNode;
  vaultContent: ReactNode;
  /** When true, Vault tab is disabled; user must Deactivate in Capture first. */
  vaultTabDisabled?: boolean;
}

export function PopupTabs({
  captureContent,
  vaultContent,
  vaultTabDisabled = false,
}: PopupTabsProps) {
  return (
    <div className="h-extension w-samsung-s21 flex flex-col overflow-hidden bg-background">
      <Tabs defaultValue="capture" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full flex-shrink-0 rounded-none border-b border-border bg-card h-11 px-0">
          <TabsTrigger
            value="capture"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
          >
            Capture
          </TabsTrigger>
          <TabsTrigger
            value="vault"
            disabled={vaultTabDisabled}
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            Vault
          </TabsTrigger>
        </TabsList>
        <TabsContent value="capture" className="flex-1 min-h-0 overflow-hidden">
          {captureContent}
        </TabsContent>
        <TabsContent value="vault" className="flex-1 min-h-0 overflow-hidden">
          {vaultContent}
        </TabsContent>
      </Tabs>
    </div>
  );
}
