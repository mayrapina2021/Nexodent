const MAX = 40;

export type WaDebugEvent = {
  at: string;
  event: string;
  detail: Record<string, unknown>;
};

const _events: WaDebugEvent[] = [];

export function waDebug(event: string, detail: Record<string, unknown> = {}): void {
  _events.unshift({
    at: new Date().toISOString(),
    event,
    detail,
  });
  if (_events.length > MAX) _events.length = MAX;
}

export function getWaDebugEvents(): WaDebugEvent[] {
  return [..._events];
}
