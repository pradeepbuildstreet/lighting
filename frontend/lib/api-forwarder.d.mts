export type ApiProxyOptions = {
  origin: string;
  allowLocalHttp?: boolean;
  diagnostics?: boolean;
  timeoutMs?: number;
  maxJsonBytes?: number;
  log?: (message: string) => void;
};
export function forwardApi(request: Request, options: ApiProxyOptions): Promise<Response>;
