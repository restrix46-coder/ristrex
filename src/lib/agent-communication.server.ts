import { logger } from '@/lib/logger.server';
import { getSql } from '@/lib/db.server';

export interface AgentMessage {
  id: string;
  fromAgent: string;
  toAgent: string;
  type: 'task' | 'result' | 'error' | 'handoff' | 'query' | 'status';
  payload: any;
  correlationId: string;
  timestamp: string;
  confidence?: number;
}

export interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  context: any;
  artifacts: string[];
  remainingTasks: string[];
  reason: string;
}

export class AgentMessageBus {
  private listeners: Map<string, Array<(msg: AgentMessage) => void>> = new Map();

  /**
   * Sends a message to a specific agent.
   * يرسل رسالة إلى وكيل محدد.
   */
  async send(message: AgentMessage): Promise<void> {
    logger.info(`AgentMessageBus sending message from ${message.fromAgent} to ${message.toAgent}`, { type: message.type });
    await this.persistMessage(message);
    const agentListeners = this.listeners.get(message.toAgent);
    if (agentListeners) {
      for (const listener of agentListeners) {
        listener(message);
      }
    }
  }

  /**
   * Broadcasts a message to all registered agents.
   * يرسل رسالة إلى جميع الوكلاء المسجلين.
   */
  async broadcast(message: AgentMessage): Promise<void> {
    logger.info(`AgentMessageBus broadcasting message from ${message.fromAgent}`, { type: message.type });
    await this.persistMessage(message);
    for (const agentListeners of this.listeners.values()) {
      for (const listener of agentListeners) {
        listener(message);
      }
    }
  }

  /**
   * Handles handoff between agents.
   * يتعامل مع نقل المهام بين الوكلاء.
   */
  async handoff(handoff: AgentHandoff): Promise<void> {
    logger.info(`AgentMessageBus handoff from ${handoff.fromAgent} to ${handoff.toAgent}`);
    const message: AgentMessage = {
      id: crypto.randomUUID(),
      fromAgent: handoff.fromAgent,
      toAgent: handoff.toAgent,
      type: 'handoff',
      payload: handoff,
      correlationId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    await this.send(message);
  }

  /**
   * Retrieves messages for an agent from the database.
   * يسترجع الرسائل لوكيل معين من قاعدة البيانات.
   */
  async getMessages(agentId: string, since?: string): Promise<AgentMessage[]> {
    const sql = getSql();
    if (since) {
      return sql`SELECT * FROM agent_messages WHERE "toAgent" = ${agentId} AND timestamp > ${since} ORDER BY timestamp ASC`;
    }
    return sql`SELECT * FROM agent_messages WHERE "toAgent" = ${agentId} ORDER BY timestamp ASC`;
  }

  /**
   * Registers a listener for a specific agent.
   * يسجل مستمعًا لوكيل معين.
   */
  subscribe(agentId: string, listener: (msg: AgentMessage) => void) {
    if (!this.listeners.has(agentId)) {
      this.listeners.set(agentId, []);
    }
    this.listeners.get(agentId)!.push(listener);
  }

  private async persistMessage(message: AgentMessage) {
    try {
      const sql = getSql();
      await sql`
        INSERT INTO agent_messages (id, "fromAgent", "toAgent", type, payload, "correlationId", timestamp, confidence)
        VALUES (${message.id}, ${message.fromAgent}, ${message.toAgent}, ${message.type}, ${JSON.stringify(message.payload)}, ${message.correlationId}, ${message.timestamp}, ${message.confidence ?? null})
        ON CONFLICT (id) DO NOTHING
      `;
    } catch (e) {
      logger.error('Failed to persist agent message. Please ensure the agent_messages table exists.', { error: e });
    }
  }
}

export const agentMessageBus = new AgentMessageBus();
