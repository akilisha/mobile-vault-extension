/**
 * Stateless tab layout: Capture (default) and Vault.
 * Provides structure and styling; tab content passed as props.
 */

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export interface PopupTabsProps {
  captureContent: ReactNode;
  vaultContent: ReactNode;
}

export function PopupTabs({ captureContent, vaultContent }: PopupTabsProps) {
  return (
    <div className="h-extension w-samsung-s21 flex flex-col overflow-hidden bg-background">
      <Tabs defaultValue="capture" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full flex-shrink-0 rounded-none border-b border-border bg-card h-11 px-0">
          <TabsTrigger value="capture" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
            Capture
          </TabsTrigger>
          <TabsTrigger value="vault" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none">
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
