import { logger } from '@/lib/logger.server';

export interface TestImpactResult {
  changedFiles: string[];
  affectedTests: string[];
  unaffectedTests: string[];
  coverageMap: Record<string, string[]>;
  estimatedTimeReductionPercent: number;
}

export class TestImpactAnalyzer {
  /**
   * Builds a coverage map mapping source files to the tests that cover them.
   * @param projectPath The path to the project to analyze.
   * @returns A promise that resolves to the coverage map.
   */
  public async buildCoverageMap(projectPath: string): Promise<Record<string, string[]>> {
    logger.info(`Building coverage map for project: ${projectPath}`);
    // In a real implementation, this would parse lcov/json coverage data
    return {
      'src/lib/auth.ts': ['src/test/auth.test.ts', 'src/test/integration.test.ts'],
      'src/lib/db.ts': ['src/test/db.test.ts', 'src/test/integration.test.ts'],
    };
  }

  /**
   * Retrieves a list of tests affected by the given changed files.
   * @param changedFiles List of files that changed.
   * @param coverageMap The coverage map mapping files to tests.
   * @returns Array of affected test files.
   */
  public getAffectedTests(changedFiles: string[], coverageMap: Record<string, string[]>): string[] {
    const affected = new Set<string>();
    for (const file of changedFiles) {
      const tests = coverageMap[file];
      if (tests) {
        tests.forEach(test => affected.add(test));
      }
    }
    return Array.from(affected);
  }

  /**
   * Estimates the time reduction percentage based on affected tests versus all tests.
   * @param affectedTests Tests that are affected.
   * @param allTests All tests in the suite.
   * @param avgTestMs Average execution time per test.
   * @returns The estimated time reduction percentage.
   */
  public estimateTimeReduction(affectedTests: string[], allTests: string[], avgTestMs: number): number {
    if (allTests.length === 0) return 0;
    const affectedRatio = affectedTests.length / allTests.length;
    return (1 - affectedRatio) * 100;
  }

  /**
   * Analyzes the impact of changes to determine which tests should be run.
   * @param changedFiles The files that were modified.
   * @param coverageData Coverage data mapping files to tests.
   * @returns The test impact result.
   */
  public analyze(changedFiles: string[], coverageData: Record<string, string[]>): TestImpactResult {
    const allTestsSet = new Set<string>();
    for (const file in coverageData) {
      coverageData[file].forEach(t => allTestsSet.add(t));
    }
    const allTests = Array.from(allTestsSet);
    
    const affectedTests = this.getAffectedTests(changedFiles, coverageData);
    const unaffectedTests = allTests.filter(t => !affectedTests.includes(t));
    
    const estimatedTimeReductionPercent = this.estimateTimeReduction(affectedTests, allTests, 1000);

    return {
      changedFiles,
      affectedTests,
      unaffectedTests,
      coverageMap: coverageData,
      estimatedTimeReductionPercent,
    };
  }

  /**
   * Prioritizes tests based on a risk level map.
   * @param tests List of tests to prioritize.
   * @param riskLevel Map of test name to risk level score.
   * @returns Prioritized list of tests.
   */
  public prioritizeTests(tests: string[], riskLevel: Record<string, number>): string[] {
    return [...tests].sort((a, b) => {
      const riskA = riskLevel[a] || 0;
      const riskB = riskLevel[b] || 0;
      return riskB - riskA; // Descending order of risk
    });
  }

  /**
   * Generates a markdown report summarizing the test impact analysis.
   * @param result The result of the analysis.
   * @returns A markdown string report.
   */
  public generateReport(result: TestImpactResult): string {
    const changedList = result.changedFiles.map(f => `- ${f}`).join('\n');
    const affectedList = result.affectedTests.map(f => `- ${f}`).join('\n');
    
    return `
# Test Impact Analysis Report

## Overview
- **Changed Files**: ${result.changedFiles.length}
- **Affected Tests**: ${result.affectedTests.length}
- **Unaffected Tests**: ${result.unaffectedTests.length}
- **Estimated Time Reduction**: ${result.estimatedTimeReductionPercent.toFixed(2)}%

## Changed Files
${changedList}

## Tests to Run (Affected)
${affectedList}
    `.trim();
  }
}

export const testImpactAnalyzer = new TestImpactAnalyzer();
