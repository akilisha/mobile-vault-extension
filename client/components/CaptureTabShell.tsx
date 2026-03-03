/**
 * Capture tab shell (Phase 1). Heading + Activate (no-op until Phase 2).
 * No explanatory copy; UI accommodates connection etc. without prose.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CaptureTabShell() {
  return (
    <div className="flex flex-col h-full p-4">
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 flex-1">
          <Button
            className="w-full"
            onClick={() => {}}
          >
            Activate
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
