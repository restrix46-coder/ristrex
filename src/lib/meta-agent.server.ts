export interface AgentCapability {
    agentType: string;
    strengths: string[];
    weaknesses: string[];
    bestFor: string[];
    costMultiplier: number;
    avgLatencyMs: number;
}

export interface RoutingDecision {
    selectedAgent: string;
    selectedModel: string;
    selectedTools: string[];
    contextStrategy: string;
    estimatedCostUsd: number;
    estimatedLatencyMs: number;
    requiresApproval: boolean;
    rationale: string;
}

export interface MetaDecision {
    taskId: string;
    routing: RoutingDecision;
    confidenceScore: number;
    alternativeRoutings: RoutingDecision[];
    needsHumanInput: boolean;
    humanInputReason?: string;
}

export class MetaAgent {
    
    private defaultAgents: AgentCapability[] = [
        {
            agentType: 'coder',
            strengths: ['writing logic', 'refactoring', 'tests'],
            weaknesses: ['designing complex architectures', 'UI aesthetics'],
            bestFor: ['backend tasks', 'algorithm implementation'],
            costMultiplier: 1.0,
            avgLatencyMs: 3000
        },
        {
            agentType: 'architect',
            strengths: ['system design', 'tech stack selection', 'best practices'],
            weaknesses: ['writing boilerplate code'],
            bestFor: ['project setup', 'ADR creation'],
            costMultiplier: 1.5,
            avgLatencyMs: 5000
        }
    ];

    /**
     * Determines the optimal execution strategy for a task.
     */
    route(task: string, context: any, constraints: any): MetaDecision {
        const selectedAgent = this.selectAgent(task, this.defaultAgents);
        const selectedModel = this.selectModel(task, selectedAgent, constraints.budget || 1.0);
        const selectedTools = this.selectTools(task, selectedAgent, context.permissions || []);
        
        const risk = this.detectAmbiguity(task).isAmbiguous ? 'high' : 'low';
        const requiresApproval = this.shouldAskForApproval(task, risk);

        const routing: RoutingDecision = {
            selectedAgent,
            selectedModel,
            selectedTools,
            contextStrategy: 'full',
            estimatedCostUsd: 0.05,
            estimatedLatencyMs: 4000,
            requiresApproval,
            rationale: `Selected ${selectedAgent} because task relates to ${selectedAgent === 'architect' ? 'design' : 'coding'}.`
        };

        return {
            taskId: context.taskId || 'generated-task-id',
            routing,
            confidenceScore: 0.85,
            alternativeRoutings: [],
            needsHumanInput: requiresApproval,
            humanInputReason: requiresApproval ? 'High ambiguity detected in task description.' : undefined
        };
    }

    /**
     * Select best agent type from available.
     */
    selectAgent(task: string, availableAgents: AgentCapability[]): string {
        const lowerTask = task.toLowerCase();
        if (lowerTask.includes('architecture') || lowerTask.includes('design') || lowerTask.includes('setup')) {
            return 'architect';
        }
        return 'coder';
    }

    /**
     * Select best model.
     */
    selectModel(task: string, agent: string, budget: number): string {
        if (budget > 5.0 && agent === 'architect') {
            return 'gpt-4o'; // Generic representation
        }
        return 'gpt-4o-mini';
    }

    /**
     * Returns tools needed for the job.
     */
    selectTools(task: string, agent: string, permissions: string[]): string[] {
        if (agent === 'coder') return ['read_file', 'write_file', 'run_tests'];
        if (agent === 'architect') return ['read_file', 'search_web'];
        return [];
    }

    /**
     * Determine if explicit human approval is needed.
     */
    shouldAskForApproval(task: string, risk: string): boolean {
        return risk === 'high' || task.includes('delete') || task.includes('drop db');
    }

    /**
     * Decide whether execution should replan based on result.
     */
    shouldReplan(executionResult: any, originalPlan: any): boolean {
        if (executionResult.error && executionResult.retryCount > 2) return true;
        return false;
    }

    /**
     * Evaluates output confidence.
     */
    evaluateConfidence(task: string, agentOutput: string): number {
        // Simplistic confidence measure
        if (!agentOutput || agentOutput.length < 50) return 0.2;
        if (agentOutput.includes('error') || agentOutput.includes('Exception')) return 0.4;
        return 0.9;
    }

    /**
     * Detects if the prompt is missing details.
     */
    detectAmbiguity(task: string): { isAmbiguous: boolean; questions: string[] } {
        const questions: string[] = [];
        if (!task.includes('using') && !task.includes('stack')) {
            questions.push('What tech stack should be used?');
        }
        return {
            isAmbiguous: questions.length > 0,
            questions
        };
    }
}

export const metaAgent = new MetaAgent();
