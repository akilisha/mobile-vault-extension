/**
 * Handshake protocol. R1 relays; A1 and C1 exchange public keys.
 */

export type HandshakeMessageType =
  | "connection-request"
  | "connection-accepted"
  | "connection-acknowledged";

export interface ConnectionRequest {
  type: "connection-request";
  publicKey: string;
}

export interface ConnectionAccepted {
  type: "connection-accepted";
  publicKey: string;
}

export interface ConnectionAcknowledged {
  type: "connection-acknowledged";
}

export type HandshakeMessage =
  | ConnectionRequest
  | ConnectionAccepted
  | ConnectionAcknowledged;

export function isConnectionRequest(obj: unknown): obj is ConnectionRequest {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as ConnectionRequest).type === "connection-request" &&
    "publicKey" in obj
  );
}

export function isConnectionAccepted(obj: unknown): obj is ConnectionAccepted {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as ConnectionAccepted).type === "connection-accepted" &&
    "publicKey" in obj
  );
}

export function isConnectionAcknowledged(
  obj: unknown
): obj is ConnectionAcknowledged {
  return (
    typeof obj === "object" &&
    obj !== null &&
    (obj as ConnectionAcknowledged).type === "connection-acknowledged"
  );
}
