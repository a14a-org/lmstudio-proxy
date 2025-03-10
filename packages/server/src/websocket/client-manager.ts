import WebSocket from 'ws';
import { createLogger } from '../utils/logger';

const logger = createLogger('client-manager');

// Define extended WebSocket type
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  isAuthenticated: boolean;
  clientId: string;
}

export class ClientManager {
  private clients: Map<string, ExtendedWebSocket> = new Map();

  /**
   * Add a new authenticated client
   */
  public addClient(clientId: string, ws: ExtendedWebSocket): void {
    if (this.clients.has(clientId)) {
      // If client ID already exists, close the old connection
      const existingWs = this.clients.get(clientId);
      if (existingWs && existingWs.readyState === WebSocket.OPEN) {
        logger.info(`Closing existing connection for client: ${clientId}`);
        existingWs.close(1000, 'Replaced by new connection');
      }
    }

    this.clients.set(clientId, ws);
    ws.clientId = clientId;
    ws.isAuthenticated = true;
    logger.info(`Registered client: ${clientId}`);
  }

  /**
   * Remove a client
   */
  public removeClient(clientId: string): void {
    if (this.clients.has(clientId)) {
      this.clients.delete(clientId);
      logger.info(`Unregistered client: ${clientId}`);
    }
  }

  /**
   * Get a client by ID
   */
  public getClient(clientId: string): ExtendedWebSocket | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all connected clients
   */
  public getAllClients(): Map<string, ExtendedWebSocket> {
    return this.clients;
  }

  /**
   * Find available clients (for load balancing or specific model support)
   */
  public findAvailableClient(_modelId?: string): ExtendedWebSocket | undefined {
    // For now, just return the first available client
    // In a more advanced implementation, this could filter by clients
    // that support specific models or have the best performance
    for (const [, ws] of this.clients) {
      if (ws.readyState === WebSocket.OPEN && ws.isAuthenticated) {
        return ws;
      }
    }
    return undefined;
  }

  /**
   * Get count of connected clients
   */
  public getClientCount(): number {
    return this.clients.size;
  }
}
