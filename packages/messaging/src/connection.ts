import { Connection } from 'rabbitmq-client';

export type ConnectionConfig = {
  /** Shown in the broker's management UI, e.g. `postroll-gateway`. */
  connectionName: string;
  url: string;
  /** Required: an unhandled `error` event would crash the process. */
  onError: (error: unknown) => void;
};

/**
 * A self-healing connection: it reconnects with exponential backoff, and the
 * consumers and publishers created from it re-declare their topology and
 * resubscribe after every reconnect.
 */
export function createConnection({ connectionName, onError, url }: ConnectionConfig): Connection {
  const connection = new Connection({ connectionName, url });
  connection.on('error', onError);

  return connection;
}
