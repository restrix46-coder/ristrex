import { routedCall } from '@/lib/model-router.server';

export interface Diagnosis {
  errorType: string;
  probableCause: string;
  confidence: number;
}

export interface RootCauseAnalysis {
  rootCause: string;
  contributingFactors: string[];
  timeline: string[];
}

export interface FixSuggestion {
  description: string;
  codeSnippet?: string;
  risk: string;
}

export interface DiagnosticsReport {
  status: string;
  issuesFound: string[];
  recommendations: string[];
}

/**
 * DebugAgent provides capabilities for diagnosing errors, finding root causes, and suggesting fixes.
 */
export class DebugAgent {
  private systemPrompt = `You are an expert debugger and systems analyst. Your goal is to pinpoint the exact root causes of issues, analyze stack traces and logs, and provide safe, effective fixes. Always return structured JSON when data is requested.`;

  /**
   * Diagnoses an error based on stack trace and context.
   * @param error The error message.
   * @param stackTrace The stack trace.
   * @param context Additional application context.
   * @returns A diagnosis object.
   */
  async diagnose(error: string, stackTrace: string, context: object): Promise<Diagnosis> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Diagnose this error: "${error}"\nStack trace:\n${stackTrace}\nContext: ${JSON.stringify(context)}\nReturn a JSON object with 'errorType' (string), 'probableCause' (string), and 'confidence' (number 0-100).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as Diagnosis;
    } catch (err) {
      throw new Error(`Failed to diagnose error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Finds the root cause from symptoms and logs.
   * @param symptoms Array of observed symptoms.
   * @param logs Relevant log output.
   * @returns A root cause analysis.
   */
  async findRootCause(symptoms: string[], logs: string): Promise<RootCauseAnalysis> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze symptoms: ${JSON.stringify(symptoms)} and logs:\n${logs}\nFind the root cause. Return a JSON object with 'rootCause' (string), 'contributingFactors' (array of strings), and 'timeline' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as RootCauseAnalysis;
    } catch (error) {
      throw new Error(`Failed to find root cause: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Suggests fixes based on a diagnosis.
   * @param diagnosis The diagnosis object.
   * @returns An array of fix suggestions.
   */
  async suggestFix(diagnosis: Diagnosis): Promise<FixSuggestion[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Suggest fixes for this diagnosis: ${JSON.stringify(diagnosis)}. Return a JSON array of objects with 'description' (string), 'codeSnippet' (optional string), and 'risk' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as FixSuggestion[];
    } catch (error) {
      throw new Error(`Failed to suggest fix: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simulates running diagnostics on a project path.
   * @param projectPath The path to the project.
   * @returns A diagnostics report.
   */
  async runDiagnostics(projectPath: string): Promise<DiagnosticsReport> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simulate a diagnostics run for project at path: "${projectPath}". Return a JSON object with 'status' (string), 'issuesFound' (array of strings), and 'recommendations' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as DiagnosticsReport;
    } catch (error) {
      throw new Error(`Failed to run diagnostics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
