import { z, ZodSchema } from 'zod';

export interface ApiContract {
  endpoint: string;
  method: string;
  requestSchema: ZodSchema;
  responseSchema: ZodSchema;
  authRequired: boolean;
  description?: string;
}

export interface ContractTestResult {
  contract: ApiContract;
  passed: boolean;
  errors: string[];
  durationMs: number;
}

const contracts: ApiContract[] = [];

/**
 * Register a new API contract
 * @param contract API Contract definition
 */
export function registerContract(contract: ApiContract): void {
  contracts.push(contract);
}

/**
 * Test a specific contract against a running instance
 * @param contract The contract to test
 * @param baseUrl The base url
 */
export async function testContract(contract: ApiContract, baseUrl: string): Promise<ContractTestResult> {
  const start = Date.now();
  const errors: string[] = [];
  
  try {
    // Basic implementation for demonstration
    if (contract.method === 'GET') {
      const response = await fetch(`${baseUrl}${contract.endpoint}`);
      if (!response.ok && contract.authRequired && response.status !== 401) {
        errors.push(`Expected 401 for missing auth, got ${response.status}`);
      }
    }
  } catch (error) {
    errors.push(String(error));
  }
  
  const durationMs = Date.now() - start;
  
  return {
    contract,
    passed: errors.length === 0,
    errors,
    durationMs
  };
}

/**
 * Run all registered contracts
 * @param baseUrl Base url
 */
export async function runAllContractTests(baseUrl: string): Promise<ContractTestResult[]> {
  const results: ContractTestResult[] = [];
  for (const contract of contracts) {
    results.push(await testContract(contract, baseUrl));
  }
  return results;
}

/**
 * Generate a Markdown report from results
 * @param results Contract test results
 */
export function generateContractReport(results: ContractTestResult[]): string {
  let report = '# API Contract Test Report\n\n';
  const passed = results.filter(r => r.passed).length;
  
  report += `Summary: ${passed} passed / ${results.length} total\n\n`;
  
  for (const res of results) {
    report += `## ${res.contract.method} ${res.contract.endpoint}\n`;
    report += `Status: ${res.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `Duration: ${res.durationMs}ms\n`;
    if (res.errors.length > 0) {
      report += `Errors:\n${res.errors.map(e => `- ${e}`).join('\n')}\n`;
    }
    report += '\n';
  }
  
  return report;
}

/**
 * Check compatibility between schema versions
 * @param oldSchema previous schema
 * @param newSchema updated schema
 */
export function checkSchemaCompatibility(oldSchema: ZodSchema, newSchema: ZodSchema): boolean {
  // Simple check for demonstration
  return oldSchema._def.typeName === newSchema._def.typeName;
}

// Pre-register main Weaver API contracts
registerContract({
  endpoint: '/api/health',
  method: 'GET',
  requestSchema: z.any(),
  responseSchema: z.object({ status: z.string() }),
  authRequired: false,
  description: 'Health check endpoint'
});

registerContract({
  endpoint: '/api/projects',
  method: 'GET',
  requestSchema: z.any(),
  responseSchema: z.array(z.object({ id: z.string(), name: z.string() })),
  authRequired: true,
  description: 'List projects'
});

registerContract({
  endpoint: '/api/projects',
  method: 'POST',
  requestSchema: z.object({ name: z.string() }),
  responseSchema: z.object({ id: z.string(), name: z.string() }),
  authRequired: true,
  description: 'Create project'
});

registerContract({
  endpoint: '/api/chat',
  method: 'POST',
  requestSchema: z.object({ message: z.string() }),
  responseSchema: z.object({ reply: z.string() }),
  authRequired: true,
  description: 'Chat endpoint'
});
