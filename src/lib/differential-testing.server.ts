import { logger } from '@/lib/logger.server';

export interface DifferentialTest {
  name: string;
  inputGenerator: () => unknown;
  implementations: Array<{ name: string; fn: (input: unknown) => unknown }>;
  comparator?: (a: unknown, b: unknown) => boolean;
}

export interface Divergence {
  input: unknown;
  outputs: Record<string, unknown>;
  description: string;
}

export interface DifferentialResult {
  test: DifferentialTest;
  totalCases: number;
  divergences: Divergence[];
  passedCases: number;
  divergenceRate: number;
}

export class DifferentialTester {
  /**
   * Runs a differential test across implementations.
   * @param test The differential test spec.
   * @param cases Number of iterations.
   * @returns The differential result.
   */
  public async run(test: DifferentialTest, cases = 100): Promise<DifferentialResult> {
    logger.info(`Running differential test: ${test.name}`);
    const divergences: Divergence[] = [];
    let passedCases = 0;

    const comparator = test.comparator || ((a, b) => JSON.stringify(a) === JSON.stringify(b));

    for (let i = 0; i < cases; i++) {
      const input = test.inputGenerator();
      const outputs: Record<string, unknown> = {};
      
      let firstOutput: unknown;
      let firstImplName = '';
      let isDivergent = false;

      for (const impl of test.implementations) {
        try {
          const result = await impl.fn(input);
          outputs[impl.name] = result;
          
          if (!firstImplName) {
            firstOutput = result;
            firstImplName = impl.name;
          } else if (!comparator(firstOutput, result)) {
            isDivergent = true;
          }
        } catch (error: any) {
          outputs[impl.name] = `ERROR: ${error.message}`;
          isDivergent = true;
        }
      }

      if (isDivergent) {
        divergences.push({
          input,
          outputs,
          description: 'Output mismatch among implementations',
        });
      } else {
        passedCases++;
      }
    }

    return {
      test,
      totalCases: cases,
      divergences,
      passedCases,
      divergenceRate: (divergences.length / cases) * 100
    };
  }

  /**
   * Convenience method to compare an old and new function.
   * @param oldFn Legacy implementation.
   * @param newFn Refactored implementation.
   * @param inputGenerator Generator for inputs.
   * @param cases Number of test cases.
   * @returns Differential result.
   */
  public async compareVersions(
    oldFn: (input: unknown) => unknown,
    newFn: (input: unknown) => unknown,
    inputGenerator: () => unknown,
    cases = 100
  ): Promise<DifferentialResult> {
    return this.run({
      name: 'Version Comparison',
      inputGenerator,
      implementations: [
        { name: 'v1 (Legacy)', fn: oldFn },
        { name: 'v2 (New)', fn: newFn }
      ]
    }, cases);
  }

  /**
   * Extracts edge cases from a list of divergences.
   * @param divergences Array of divergences.
   * @returns A subset that likely represents unique edge cases.
   */
  public findEdgeCases(divergences: Divergence[]): Divergence[] {
    const seen = new Set<string>();
    return divergences.filter(d => {
      const key = typeof d.input === 'object' ? Object.keys(d.input as object).join(',') : String(d.input);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generates a markdown report for differential testing.
   * @param result The differential test result.
   * @returns Markdown report.
   */
  public generateReport(result: DifferentialResult): string {
    return `
# Differential Testing Report: ${result.test.name}
- **Total Cases**: ${result.totalCases}
- **Passed Cases**: ${result.passedCases}
- **Divergences**: ${result.divergences.length}
- **Divergence Rate**: ${result.divergenceRate.toFixed(2)}%

## Example Divergences
${result.divergences.slice(0, 3).map(d => `- Input: ${JSON.stringify(d.input)} | Outputs: ${JSON.stringify(d.outputs)}`).join('\n')}
    `.trim();
  }
}

export const differentialTester = new DifferentialTester();
