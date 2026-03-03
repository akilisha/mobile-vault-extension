/**
 * Capture tab shell. Heading + Activate/Deactivate; callbacks wired for content-script phase.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CaptureTabShellProps {
  /** When true, capture is watching the current tab; show Deactivate. */
  active?: boolean;
  onActivate?: () => void;
  onDeactivate?: () => void;
}

export function CaptureTabShell({
  active = false,
  onActivate,
  onDeactivate,
}: CaptureTabShellProps) {
  return (
    <div className="flex flex-col h-full min-h-0 p-4">
      <Card className="flex-1 flex flex-col min-h-0">
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="text-lg">Capture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 min-h-0">
          {active ? (
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => onDeactivate?.()}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => onActivate?.()}
            >
              Activate
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
