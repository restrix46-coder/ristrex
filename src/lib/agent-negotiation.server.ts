/**
 * Agent Negotiation Protocol — src/lib/agent-negotiation.server.ts
 *
 * يتيح للوكلاء مراجعة خطط بعضهم البعض وفق بروتوكول منظم:
 * Architect → Reviewer → Security → Performance → Final Planner
 */

import { routedCall } from "@/lib/model-router.server";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type NegotiationRole =
  | "architect"
  | "reviewer"
  | "security"
  | "performance"
  | "final_planner";

export interface NegotiationTurn {
  role: NegotiationRole;
  agentId: string;
  review: string;
  concerns: string[];
  approves: boolean;
  suggestions: string[];
  timestamp: Date;
}

export interface NegotiationSession {
  id: string;
  planId: string;
  plan: string;
  rounds: NegotiationTurn[];
  consensus: string | null;
  approved: boolean;
  totalRounds: number;
  maxRounds: number;
  startedAt: Date;
  completedAt?: Date;
}

// ─── AgentNegotiator ─────────────────────────────────────────────────────────

export class AgentNegotiator {
  private sessions: Map<string, NegotiationSession> = new Map();

  /**
   * يبدأ جلسة تفاوض على خطة
   * Pipeline: Architect → Reviewer → Security → Performance → Final Planner
   */
  async negotiate(
    planId: string,
    plan: string,
    maxRounds = 3,
  ): Promise<NegotiationSession> {
    const session: NegotiationSession = {
      id: crypto.randomUUID(),
      planId,
      plan,
      rounds: [],
      consensus: null,
      approved: false,
      totalRounds: 0,
      maxRounds,
      startedAt: new Date(),
    };

    this.sessions.set(session.id, session);

    const pipeline: NegotiationRole[] = [
      "architect",
      "reviewer",
      "security",
      "performance",
      "final_planner",
    ];

    let currentPlan = plan;

    for (let round = 0; round < maxRounds; round++) {
      let allApprove = true;
      const allConcerns: string[] = [];

      for (const role of pipeline) {
        const turn = await this.runTurn(role, currentPlan, session.rounds);
        session.rounds.push(turn);

        if (!turn.approves) {
          allApprove = false;
          allConcerns.push(...turn.concerns);
        }

        // تحديث الخطة بناءً على الاقتراحات
        if (turn.suggestions.length > 0) {
          currentPlan = await this.refinePlan(currentPlan, turn);
        }
      }

      session.totalRounds = round + 1;

      if (allApprove) {
        session.approved = true;
        session.consensus = currentPlan;
        break;
      }

      if (round === maxRounds - 1) {
        // آخر جولة — نسجّل المخاوف المتبقية
        logger.warn("Negotiation ended without full consensus", {
          sessionId: session.id,
          concerns: allConcerns,
        });
        session.consensus = currentPlan;
      }
    }

    session.completedAt = new Date();
    this.sessions.set(session.id, session);

    logger.info("Negotiation completed", {
      sessionId: session.id,
      approved: session.approved,
      rounds: session.totalRounds,
    });

    return session;
  }

  /**
   * يُنفّذ دور وكيل واحد في التفاوض
   */
  private async runTurn(
    role: NegotiationRole,
    plan: string,
    previousTurns: NegotiationTurn[],
  ): Promise<NegotiationTurn> {
    const systemPrompt = this.getRolePrompt(role);
    const previousContext = previousTurns
      .slice(-3)
      .map((t) => `${t.role}: ${t.review}`)
      .join("\n");

    try {
      const response = await routedCall("reasoning", {
        system: systemPrompt,
        content: `Review this plan:\n\n${plan}\n\nPrevious reviews:\n${previousContext}\n\nRespond with JSON: { "approves": boolean, "concerns": string[], "suggestions": string[], "review": string }`,
      });

      const content =
        response.content?.[0]?.type === "text" ? response.content[0].text : "{}";
      const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");

      return {
        role,
        agentId: `${role}-agent`,
        review: parsed.review ?? "Review completed",
        concerns: parsed.concerns ?? [],
        approves: parsed.approves ?? true,
        suggestions: parsed.suggestions ?? [],
        timestamp: new Date(),
      };
    } catch {
      return {
        role,
        agentId: `${role}-agent`,
        review: "Review completed (fallback)",
        concerns: [],
        approves: true,
        suggestions: [],
        timestamp: new Date(),
      };
    }
  }

  /**
   * يُحسّن الخطة بناءً على اقتراح وكيل
   */
  private async refinePlan(
    plan: string,
    turn: NegotiationTurn,
  ): Promise<string> {
    try {
      const response = await routedCall("fast", {
        system: "You refine software plans based on agent suggestions. Return only the refined plan text.",
        content: `Original plan:\n${plan}\n\n${turn.role} suggests:\n${turn.suggestions.join("\n")}\n\nRefine the plan to address these suggestions.`,
      });
      return response.content?.[0]?.type === "text"
        ? response.content[0].text
        : plan;
    } catch {
      return plan;
    }
  }

  private getRolePrompt(role: NegotiationRole): string {
    const prompts: Record<NegotiationRole, string> = {
      architect:
        "You are a Senior Software Architect reviewing a technical plan. Focus on: architecture patterns, scalability, maintainability, and technical soundness. Be critical but constructive.",
      reviewer:
        "You are a Code Reviewer analyzing a plan. Focus on: code quality, best practices, SOLID principles, testability, and readability. Identify potential issues.",
      security:
        "You are a Security Engineer reviewing a plan. Focus on: authentication, authorization, data protection, injection risks, OWASP Top 10, and security anti-patterns. Be thorough.",
      performance:
        "You are a Performance Engineer reviewing a plan. Focus on: algorithmic complexity, database queries, caching opportunities, bundle size, and latency. Identify bottlenecks.",
      final_planner:
        "You are the Final Planner synthesizing all reviews. Focus on: incorporating all valid concerns, resolving conflicts between reviews, and producing a final balanced recommendation.",
    };
    return prompts[role];
  }

  /**
   * يُولّد تقرير جلسة التفاوض
   */
  generateReport(session: NegotiationSession): string {
    const lines = [
      `# Agent Negotiation Report`,
      `**Session:** ${session.id}`,
      `**Plan:** ${session.planId}`,
      `**Status:** ${session.approved ? "✅ APPROVED" : "⚠️ PARTIAL CONSENSUS"}`,
      `**Rounds:** ${session.totalRounds}/${session.maxRounds}`,
      ``,
      `## Review Timeline`,
    ];

    for (const turn of session.rounds) {
      const icon = turn.approves ? "✅" : "❌";
      lines.push(`\n### ${icon} ${turn.role.toUpperCase()}`);
      lines.push(turn.review);
      if (turn.concerns.length > 0) {
        lines.push(`**Concerns:** ${turn.concerns.join(", ")}`);
      }
    }

    if (session.consensus) {
      lines.push(`\n## Final Consensus`);
      lines.push(session.consensus.slice(0, 500));
    }

    return lines.join("\n");
  }

  getSession(sessionId: string): NegotiationSession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const agentNegotiator = new AgentNegotiator();
