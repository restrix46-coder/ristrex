import { logger } from '@/lib/logger';

export interface UserPersona {
  id: string;
  name: string;
  role: 'new_user' | 'power_user' | 'admin' | 'mobile_user' | 'accessibility_user';
  behaviors: string[];
  goals: string[];
  painPoints: string[];
}

export interface StepResult {
  stepName: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface UxIssue {
  step: string;
  type: 'confusion' | 'error' | 'slow_response' | 'missing_feedback' | 'accessibility';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

export interface SyntheticTestResult {
  persona: UserPersona;
  flow: string;
  steps: StepResult[];
  issues: UxIssue[];
  score: number;
  recommendations: string[];
}

const PERSONAS: Record<string, UserPersona> = {
  NewUser: {
    id: 'persona-1',
    name: 'Newbie Nick',
    role: 'new_user',
    behaviors: ['Clicks slowly', 'Reads tooltips', 'Gets lost easily'],
    goals: ['Complete onboarding', 'Create first project'],
    painPoints: ['Complex jargon', 'Hidden buttons']
  },
  PowerUser: {
    id: 'persona-2',
    name: 'Power Penny',
    role: 'power_user',
    behaviors: ['Uses keyboard shortcuts', 'Skips tutorials', 'Navigates quickly'],
    goals: ['Maximize efficiency', 'Use advanced integrations'],
    painPoints: ['Slow loading times', 'Too many clicks required']
  },
  AdminUser: {
    id: 'persona-3',
    name: 'Admin Alex',
    role: 'admin',
    behaviors: ['Checks settings first', 'Looks for bulk actions'],
    goals: ['Manage team access', 'Review billing'],
    painPoints: ['Lack of audit logs', 'Unclear permissions']
  },
  MobileUser: {
    id: 'persona-4',
    name: 'Mobile Mia',
    role: 'mobile_user',
    behaviors: ['Taps elements', 'Scrolls vertically'],
    goals: ['Check status on the go', 'Quick approvals'],
    painPoints: ['Small touch targets', 'Non-responsive design']
  },
  AccessibilityUser: {
    id: 'persona-5',
    name: 'Access Aaron',
    role: 'accessibility_user',
    behaviors: ['Uses screen reader', 'Relies on keyboard navigation'],
    goals: ['Complete all tasks without mouse'],
    painPoints: ['Missing ARIA labels', 'Low contrast text']
  }
};

/**
 * Service to simulate and analyze user behavior across different flows.
 */
export class SyntheticUserTester {

  /**
   * Creates or retrieves a user persona for testing.
   * @param type - The role or type of persona
   * @returns UserPersona object
   */
  createPersona(type: string): UserPersona {
    const persona = PERSONAS[type];
    if (!persona) {
      throw new Error(`Persona type ${type} not found. Available: ${Object.keys(PERSONAS).join(', ')}`);
    }
    return persona;
  }

  /**
   * Generates common user flows to test based on project type.
   * @param projectType - Project domain (e.g. 'saas', 'ecommerce')
   * @returns Array of flow descriptions
   */
  generateTestFlows(projectType: string): string[] {
    if (projectType === 'saas') {
      return ['Registration', 'Login', 'CreateProject', 'ManageSettings', 'BillingFlow'];
    }
    return ['Home', 'Search', 'Checkout'];
  }

  /**
   * Simulates running a specific user flow.
   * @param persona - The user persona driving the test
   * @param flow - Array of step names representing the flow
   * @param baseUrl - The base URL to test against
   * @returns Test result including identified issues
   */
  async runFlow(persona: UserPersona, flow: string[], baseUrl: string): Promise<SyntheticTestResult> {
    logger.info(`Running synthetic test for persona ${persona.name} on flow: ${flow.join(' -> ')}`);
    
    // In a real implementation, this would use Puppeteer/Playwright
    // to execute real headless browser interactions. This is mocked.
    
    const steps: StepResult[] = flow.map(step => ({
      stepName: step,
      success: true,
      durationMs: Math.random() * 1000 + 200
    }));

    const issues: UxIssue[] = [];
    
    // Inject mock issues based on persona
    if (persona.role === 'new_user' && flow.includes('ManageSettings')) {
      issues.push({
        step: 'ManageSettings',
        type: 'confusion',
        severity: 'medium',
        description: 'Advanced settings not grouped properly, causing confusion for new users.'
      });
      steps[flow.indexOf('ManageSettings')].durationMs += 5000;
    }

    if (persona.role === 'accessibility_user') {
      issues.push({
        step: flow[0],
        type: 'accessibility',
        severity: 'high',
        description: 'Main navigation missing aria-labels.'
      });
    }

    return {
      persona,
      flow: flow.join('_'),
      steps,
      issues,
      score: Math.max(0, 100 - (issues.length * 10)),
      recommendations: issues.map(i => `Fix ${i.type} issue in ${i.step}: ${i.description}`)
    };
  }

  /**
   * Analyzes UX results across multiple test runs to generate a report.
   * @param testResults - Array of test results
   * @returns Consolidated analysis report
   */
  analyzeUx(testResults: SyntheticTestResult[]): Record<string, any> {
    const totalIssues = testResults.reduce((acc, res) => acc + res.issues.length, 0);
    const averageScore = testResults.reduce((acc, res) => acc + res.score, 0) / (testResults.length || 1);

    const issueBreakdown = testResults.flatMap(r => r.issues).reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTestsRun: testResults.length,
      averageScore: averageScore.toFixed(2),
      totalIssuesFound: totalIssues,
      issueBreakdown,
      topRecommendations: testResults.flatMap(r => r.recommendations).slice(0, 5)
    };
  }
}
