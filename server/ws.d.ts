declare module "ws" {
  import { EventEmitter } from "events";

  class WebSocket extends EventEmitter {
    static readonly OPEN: number;
    static readonly CLOSED: number;
    static readonly CONNECTING: number;

    readonly readyState: number;

    constructor(address: string, options?: { headers?: Record<string, string> });

    send(data: Buffer | string | ArrayBuffer): void;
    close(): void;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  export default WebSocket;
  export { WebSocket };
}
