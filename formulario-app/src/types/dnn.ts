export type DnnCodeResponse = { code: string; expires_in?: number };

export type DnnMessageType =
  | "AUTH_SUCCESS"
  | "AUTH_ERROR"
  | "NAVIGATE"
  | "ACTION_DONE"
  | "ERROR";

export type DnnMessage = {
  type: DnnMessageType;
  payload?: Record<string, unknown>;
};
