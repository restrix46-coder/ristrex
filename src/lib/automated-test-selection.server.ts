import { logger } from '@/lib/logger.server';

export interface TestSuiteSelection {
  selectedTests: string[];
  skippedTests: string[];
  estimatedDurationMs: number;
  confidenceScore: number;
  selectionStrategy: string;
}

export class AutomatedTestSelector {
  private readonly MUST_RUN_PATTERNS = [/smoke/, /security/];

  /**
   * Ranks tests based on their failure probability given change history.
   * @param tests List of tests.
   * @param changeHistory History of changes and failures.
   * @returns Ranked list of tests (highest risk first).
   */
  public rankByRisk(tests: string[], changeHistory: Record<string, number>): string[] {
    return [...tests].sort((a, b) => {
      const riskA = changeHistory[a] || 0;
      const riskB = changeHistory[b] || 0;
      return riskB - riskA;
    });
  }

  /**
   * Applies rules to ensure critical tests are always included.
   * @param tests The current selection of tests.
   * @returns Tests that match must-run rules.
   */
  public applyMustRunRules(tests: string[]): string[] {
    return tests.filter(test => 
      this.MUST_RUN_PATTERNS.some(pattern => pattern.test(test))
    );
  }

  /**
   * Selects tests based on priority fitting within a maximum duration.
   * @param tests Ranked tests.
   * @param maxDurationMs Time budget.
   * @returns Selected tests within the budget.
   */
  public selectByPriority(tests: string[], maxDurationMs: number): string[] {
    const selected: string[] = [];
    let currentDuration = 0;
    const avgTestMs = 2000; // Simulated average test time
    
    for (const test of tests) {
      if (currentDuration + avgTestMs <= maxDurationMs) {
        selected.push(test);
        currentDuration += avgTestMs;
      } else {
        break;
      }
    }
    return selected;
  }

  /**
   * Selects an optimal subset of tests to run based on changes and constraints.
   * @param allTests All available tests.
   * @param changes Files changed.
   * @param timeLimit Optional time limit in ms.
   * @returns The test suite selection result.
   */
  public select(allTests: string[], changes: string[], timeLimit?: number): TestSuiteSelection {
    try {
      logger.info('Selecting automated tests based on changes.');
      
      const mustRun = this.applyMustRunRules(allTests);
      const remainingTests = allTests.filter(t => !mustRun.includes(t));
      
      const changeHistoryMock: Record<string, number> = {};
      remainingTests.forEach((t, i) => changeHistoryMock[t] = i);
      const rankedRemaining = this.rankByRisk(remainingTests, changeHistoryMock);
      
      let selectedRemaining: string[] = [];
      if (timeLimit) {
        const mustRunTime = mustRun.length * 2000;
        const availableTime = Math.max(0, timeLimit - mustRunTime);
        selectedRemaining = this.selectByPriority(rankedRemaining, availableTime);
      } else {
        selectedRemaining = rankedRemaining;
      }

      const selectedTests = [...new Set([...mustRun, ...selectedRemaining])];
      const skippedTests = allTests.filter(t => !selectedTests.includes(t));
      
      return {
        selectedTests,
        skippedTests,
        estimatedDurationMs: selectedTests.length * 2000,
        confidenceScore: (selectedTests.length / (allTests.length || 1)) * 100,
        selectionStrategy: timeLimit ? 'time-budgeted' : 'comprehensive',
      };
    } catch (error) {
      logger.error('Failed to select tests', { error });
      return {
        selectedTests: allTests,
        skippedTests: [],
        estimatedDurationMs: allTests.length * 2000,
        confidenceScore: 100,
        selectionStrategy: 'fallback-all',
      };
    }
  }

  /**
   * Generates a markdown report for test selection.
   * @param selection The selected test suite.
   * @returns Markdown formatted report.
   */
  public generateSelectionReport(selection: TestSuiteSelection): string {
    return `
# Test Selection Report
- **Strategy**: ${selection.selectionStrategy}
- **Selected Tests**: ${selection.selectedTests.length}
- **Skipped Tests**: ${selection.skippedTests.length}
- **Estimated Duration**: ${selection.estimatedDurationMs}ms
- **Confidence Score**: ${selection.confidenceScore.toFixed(1)}%

## Selected
${selection.selectedTests.map(t => `- ${t}`).join('\n')}
    `.trim();
  }
}

export const automatedTestSelector = new AutomatedTestSelector();
