import { getSql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const STATE_MACHINE_MIGRATION = `
CREATE TABLE IF NOT EXISTS state_machine_instances (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL,
  current_state TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS state_transitions (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL REFERENCES state_machine_instances(id),
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  event TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export interface Transition<S> {
  target: S;
  guard?: string;
  actions?: string[];
}

export interface StateConfig<S extends string, E extends string> {
  on?: Record<E, Transition<S>>;
  entry?: string[];
  exit?: string[];
  type?: 'final' | 'parallel';
}

export interface StateMachineDefinition<S extends string, E extends string> {
  id: string;
  name: string;
  initial: S;
  states: Record<S, StateConfig<S, E>>;
  context?: object;
}

export interface StateTransition {
  id?: string;
  instanceId?: string;
  fromState: string;
  toState: string;
  event: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface StateMachineInstance {
  id: string;
  definitionId: string;
  currentState: string;
  context: object;
  history: StateTransition[];
  createdAt: Date;
  updatedAt: Date;
}

export class StateMachineEngine {
  private definitions = new Map<string, StateMachineDefinition<any, any>>();

  /**
   * Registers a state machine definition
   * @param definition Definition of the state machine
   */
  public register<S extends string, E extends string>(definition: StateMachineDefinition<S, E>): void {
    this.definitions.set(definition.id, definition);
  }

  /**
   * Creates a new instance of a registered state machine
   * @param definitionId The ID of the state machine definition
   * @param context Initial context data
   * @returns The created state machine instance
   */
  public async create(definitionId: string, context: object = {}): Promise<StateMachineInstance> {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`StateMachineDefinition with id ${definitionId} not found`);
    }

    const id = randomUUID();
    const sql = await getSql();

    await sql`
      INSERT INTO state_machine_instances (id, definition_id, current_state, context)
      VALUES (${id}, ${definitionId}, ${definition.initial}, ${JSON.stringify(context)})
    `;

    return {
      id,
      definitionId,
      currentState: definition.initial,
      context,
      history: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Sends an event to a state machine instance
   * @param instanceId The instance ID
   * @param event The event to trigger
   * @param payload Optional payload
   * @returns Updated instance
   */
  public async send(instanceId: string, event: string, payload?: any): Promise<StateMachineInstance> {
    const sql = await getSql();
    
    // Fetch instance
    const [row] = await sql`SELECT * FROM state_machine_instances WHERE id = ${instanceId}`;
    if (!row) throw new Error(`Instance ${instanceId} not found`);

    const definition = this.definitions.get(row.definition_id);
    if (!definition) throw new Error(`Definition ${row.definition_id} not found`);

    const currentStateConfig = definition.states[row.current_state];
    if (!currentStateConfig || !currentStateConfig.on || !currentStateConfig.on[event]) {
      throw new Error(`Event ${event} not allowed in state ${row.current_state}`);
    }

    const transition = currentStateConfig.on[event];
    const newState = transition.target;

    const transitionId = randomUUID();

    await sql.begin(async (tx: any) => {
      await tx`
        UPDATE state_machine_instances
        SET current_state = ${newState}, updated_at = NOW()
        WHERE id = ${instanceId}
      `;

      await tx`
        INSERT INTO state_transitions (id, instance_id, from_state, to_state, event, metadata)
        VALUES (${transitionId}, ${instanceId}, ${row.current_state}, ${newState}, ${event}, ${JSON.stringify(payload || {})})
      `;
    });

    return this.getState(instanceId);
  }

  /**
   * Gets the current state of a state machine instance
   */
  public async getState(instanceId: string): Promise<StateMachineInstance> {
    const sql = await getSql();
    const [row] = await sql`SELECT * FROM state_machine_instances WHERE id = ${instanceId}`;
    if (!row) throw new Error(`Instance ${instanceId} not found`);

    const history = await this.getHistory(instanceId);

    return {
      id: row.id,
      definitionId: row.definition_id,
      currentState: row.current_state,
      context: row.context || {},
      history,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Checks if an event can be sent in the current state
   */
  public async can(instanceId: string, event: string): Promise<boolean> {
    const sql = await getSql();
    const [row] = await sql`SELECT current_state, definition_id FROM state_machine_instances WHERE id = ${instanceId}`;
    if (!row) return false;

    const definition = this.definitions.get(row.definition_id);
    if (!definition) return false;

    const currentStateConfig = definition.states[row.current_state];
    return !!(currentStateConfig && currentStateConfig.on && currentStateConfig.on[event]);
  }

  /**
   * Retrieves the transition history
   */
  public async getHistory(instanceId: string): Promise<StateTransition[]> {
    const sql = await getSql();
    const rows = await sql`SELECT * FROM state_transitions WHERE instance_id = ${instanceId} ORDER BY timestamp ASC`;
    return rows.map((r: any) => ({
      id: r.id,
      instanceId: r.instance_id,
      fromState: r.from_state,
      toState: r.to_state,
      event: r.event,
      timestamp: r.timestamp,
      metadata: r.metadata
    }));
  }
}

export const stateMachineEngine = new StateMachineEngine();

// Pre-defined State Machines
stateMachineEngine.register({
  id: 'ORDER_STATE_MACHINE',
  name: 'Order Lifecycle',
  initial: 'pending',
  states: {
    pending: { on: { CONFIRM: { target: 'confirmed' }, CANCEL: { target: 'cancelled' } } },
    confirmed: { on: { PROCESS: { target: 'processing' } } },
    processing: { on: { SHIP: { target: 'shipped' } } },
    shipped: { on: { DELIVER: { target: 'delivered' } } },
    delivered: { type: 'final' },
    cancelled: { type: 'final' }
  }
});

stateMachineEngine.register({
  id: 'PAYMENT_STATE_MACHINE',
  name: 'Payment Lifecycle',
  initial: 'pending',
  states: {
    pending: { on: { PROCESS: { target: 'processing' } } },
    processing: { on: { SUCCEED: { target: 'succeeded' }, FAIL: { target: 'failed' } } },
    succeeded: { on: { REFUND: { target: 'refunded' } } },
    failed: { type: 'final' },
    refunded: { type: 'final' }
  }
});

stateMachineEngine.register({
  id: 'DEPLOYMENT_STATE_MACHINE',
  name: 'Deployment Lifecycle',
  initial: 'pending',
  states: {
    pending: { on: { BUILD: { target: 'building' } } },
    building: { on: { TEST: { target: 'testing' }, FAIL: { target: 'failed' } } },
    testing: { on: { DEPLOY: { target: 'deploying' }, FAIL: { target: 'failed' } } },
    deploying: { on: { SUCCESS: { target: 'live' }, ROLLBACK: { target: 'rolledback' }, FAIL: { target: 'failed' } } },
    live: { on: { ROLLBACK: { target: 'rolledback' } } },
    failed: { type: 'final' },
    rolledback: { type: 'final' }
  }
});

stateMachineEngine.register({
  id: 'APPROVAL_STATE_MACHINE',
  name: 'Approval Workflow',
  initial: 'draft',
  states: {
    draft: { on: { SUBMIT: { target: 'submitted' } } },
    submitted: { on: { REVIEW: { target: 'under_review' } } },
    under_review: { on: { APPROVE: { target: 'approved' }, REJECT: { target: 'rejected' } } },
    approved: { type: 'final' },
    rejected: { type: 'final' }
  }
});

stateMachineEngine.register({
  id: 'SUBSCRIPTION_STATE_MACHINE',
  name: 'Subscription Lifecycle',
  initial: 'trialing',
  states: {
    trialing: { on: { ACTIVATE: { target: 'active' }, CANCEL: { target: 'cancelled' } } },
    active: { on: { FAIL_PAYMENT: { target: 'past_due' }, PAUSE: { target: 'paused' }, CANCEL: { target: 'cancelled' } } },
    past_due: { on: { PAY: { target: 'active' }, CANCEL: { target: 'cancelled' } } },
    paused: { on: { RESUME: { target: 'active' }, CANCEL: { target: 'cancelled' } } },
    cancelled: { type: 'final' }
  }
});
