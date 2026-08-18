/**
 * Semantic Diff — src/lib/semantic-diff.server.ts
 *
 * يفهم معنى التغيير لا فقط الفرق في الأسطر.
 * "تمت إضافة validation" vs "تمت إضافة 3 أسطر"
 */

import { routedCall } from "@/lib/model-router.server";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type ChangeSemantics =
  | "feature_added"
  | "feature_removed"
  | "bug_fix"
  | "refactoring"
  | "performance_improvement"
  | "security_fix"
  | "breaking_change"
  | "dependency_update"
  | "test_added"
  | "documentation"
  | "configuration"
  | "style_change";

export interface SemanticChange {
  file: string;
  semantics: ChangeSemantics[];
  summary: string;
  impact: "critical" | "high" | "medium" | "low" | "none";
  isBreaking: boolean;
  affectedApis: string[];
  affectedComponents: string[];
  requiresTest: boolean;
  requiresDocUpdate: boolean;
  humanReadable: string;
}

export interface SemanticDiffResult {
  totalFiles: number;
  changedFiles: SemanticChange[];
  overallImpact: "critical" | "high" | "medium" | "low";
  isBreaking: boolean;
  changeTypes: Record<ChangeSemantics, number>;
  summary: string;
  recommendedActions: string[];
}

// ─── SemanticDiffAnalyzer ─────────────────────────────────────────────────────

export class SemanticDiffAnalyzer {
  /**
   * يحلّل الفرق بين نسختين من الكود ويفهم المعنى
   */
  async analyze(
    before: string,
    after: string,
    filePath: string,
  ): Promise<SemanticChange> {
    // تحليل بسيط بدون AI
    const staticChange = this.staticAnalysis(before, after, filePath);

    // تحليل عميق بالـ AI
    try {
      const aiAnalysis = await this.aiAnalysis(before, after, filePath);
      return { ...staticChange, ...aiAnalysis };
    } catch {
      return staticChange;
    }
  }

  /**
   * يحلّل مجموعة من التغييرات معاً
   */
  async analyzeBatch(
    diffs: Array<{ before: string; after: string; filePath: string }>,
  ): Promise<SemanticDiffResult> {
    const changes = await Promise.all(diffs.map((d) => this.analyze(d.before, d.after, d.filePath)));

    const changeTypes = {} as Record<ChangeSemantics, number>;
    for (const change of changes) {
      for (const sem of change.semantics) {
        changeTypes[sem] = (changeTypes[sem] ?? 0) + 1;
      }
    }

    const impactLevels = ["critical", "high", "medium", "low", "none"] as const;
    const worstImpact = impactLevels.find((level) => changes.some((c) => c.impact === level)) ?? "none";
    const isBreaking = changes.some((c) => c.isBreaking);

    const recommendedActions = this.generateRecommendations(changes);

    return {
      totalFiles: diffs.length,
      changedFiles: changes,
      overallImpact: worstImpact === "none" ? "low" : worstImpact,
      isBreaking,
      changeTypes,
      summary: this.generateSummary(changes, changeTypes),
      recommendedActions,
    };
  }

  /**
   * يُولّد تقرير قابل للقراءة
   */
  generateReport(result: SemanticDiffResult): string {
    const lines = [
      `# Semantic Diff Report`,
      `**Overall Impact:** ${result.overallImpact.toUpperCase()}`,
      `**Breaking Change:** ${result.isBreaking ? "⚠️ YES" : "✅ No"}`,
      ``,
      `## Summary`,
      result.summary,
      ``,
      `## Changed Files (${result.totalFiles})`,
    ];

    for (const change of result.changedFiles) {
      const icon = { critical: "🔴", high: "🟠", medium: "🟡", low: "🟢", none: "⚪" }[change.impact];
      lines.push(`\n### ${icon} \`${change.file}\``);
      lines.push(`**Semantics:** ${change.semantics.join(", ")}`);
      lines.push(`**Summary:** ${change.humanReadable}`);
      if (change.isBreaking) lines.push("⚠️ **BREAKING CHANGE**");
      if (change.affectedApis.length) lines.push(`**Affected APIs:** ${change.affectedApis.join(", ")}`);
    }

    if (result.recommendedActions.length) {
      lines.push(`\n## Recommended Actions`);
      for (const action of result.recommendedActions) {
        lines.push(`- ${action}`);
      }
    }

    return lines.join("\n");
  }

  private staticAnalysis(before: string, after: string, filePath: string): SemanticChange {
    const semantics: ChangeSemantics[] = [];
    const added = after.length - before.length;

    // تحليل بسيط بالـ Keywords
    if (before.length === 0) semantics.push("feature_added");
    if (after.length === 0) semantics.push("feature_removed");
    if (/test|spec|\.test\.|\.spec\./.test(filePath)) semantics.push("test_added");
    if (/readme|changelog|\.md$/i.test(filePath)) semantics.push("documentation");
    if (/config|\.env|settings/.test(filePath)) semantics.push("configuration");
    if (/fix|bug|patch/i.test(after) && added < 50) semantics.push("bug_fix");
    if (/security|auth|csrf|xss/i.test(after)) semantics.push("security_fix");
    if (semantics.length === 0) semantics.push("refactoring");

    const isBreaking =
      semantics.includes("feature_removed") ||
      (before.includes("export") && !after.includes("export"));

    return {
      file: filePath,
      semantics,
      summary: `${semantics.join(", ")} in ${filePath}`,
      impact: isBreaking ? "high" : added > 100 ? "medium" : "low",
      isBreaking,
      affectedApis: [],
      affectedComponents: [],
      requiresTest: semantics.includes("feature_added") || semantics.includes("bug_fix"),
      requiresDocUpdate: semantics.includes("feature_added") || isBreaking,
      humanReadable: `${isBreaking ? "Breaking: " : ""}${semantics[0]?.replace(/_/g, " ")} in ${filePath.split("/").pop()}`,
    };
  }

  private async aiAnalysis(before: string, after: string, filePath: string): Promise<Partial<SemanticChange>> {
    const snippet = `File: ${filePath}\n\nBEFORE (first 500 chars):\n${before.slice(0, 500)}\n\nAFTER (first 500 chars):\n${after.slice(0, 500)}`;

    const response = await routedCall("fast", {
      system: "You are a code change analyzer. Respond with JSON only containing: { summary, isBreaking, humanReadable }",
      content: `Analyze this code change semantically:\n${snippet}`,
    });

    try {
      const content = response.content?.[0]?.type === "text" ? response.content[0].text : "{}";
      return JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    } catch {
      return {};
    }
  }

  private generateSummary(changes: SemanticChange[], types: Record<string, number>): string {
    const parts: string[] = [];
    if (types.feature_added) parts.push(`${types.feature_added} features added`);
    if (types.bug_fix) parts.push(`${types.bug_fix} bugs fixed`);
    if (types.breaking_change) parts.push(`${types.breaking_change} breaking changes`);
    if (types.security_fix) parts.push(`${types.security_fix} security fixes`);
    if (types.refactoring) parts.push(`${types.refactoring} refactoring changes`);
    return parts.join(", ") || "Minor changes";
  }

  private generateRecommendations(changes: SemanticChange[]): string[] {
    const recs: string[] = [];
    if (changes.some((c) => c.requiresTest)) recs.push("Add or update tests for changed functionality");
    if (changes.some((c) => c.requiresDocUpdate)) recs.push("Update documentation for new/changed features");
    if (changes.some((c) => c.isBreaking)) recs.push("Bump major version and add migration guide");
    if (changes.some((c) => c.semantics.includes("security_fix"))) recs.push("Run security scan after security fixes");
    return recs;
  }
}

export const semanticDiff = new SemanticDiffAnalyzer();
