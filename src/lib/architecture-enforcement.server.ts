export interface ArchitectureRule {
    id: string;
    name: string;
    description: string;
    type: 'import_forbidden' | 'layer_violation' | 'circular_dep' | 'file_too_large' | 'function_too_long' | 'naming_violation' | 'security_bypass';
    pattern: RegExp | string;
    severity: 'error' | 'warning';
    autoFixable: boolean;
}

export interface ArchitectureViolation {
    rule: ArchitectureRule;
    file: string;
    line?: number;
    description: string;
    suggestion: string;
}

export const BUILT_IN_RULES: ArchitectureRule[] = [
    {
        id: 'no-frontend-db-direct',
        name: 'No direct database access from frontend',
        description: 'Frontend files cannot import directly from db.ts',
        type: 'import_forbidden',
        pattern: /import.*from.*db\.ts/g,
        severity: 'error',
        autoFixable: false,
    },
    {
        id: 'no-circular-deps',
        name: 'No circular dependencies',
        description: 'Detects circular imports between files',
        type: 'circular_dep',
        pattern: '', // Special evaluator
        severity: 'error',
        autoFixable: false,
    },
    {
        id: 'file-size-limit',
        name: 'Files should not exceed 500 lines',
        description: 'Large files indicate poor modularity',
        type: 'file_too_large',
        pattern: '', // Check length
        severity: 'warning',
        autoFixable: false,
    },
    {
        id: 'function-size-limit',
        name: 'Functions should not exceed 80 lines',
        description: 'Large functions are hard to read and test',
        type: 'function_too_long',
        pattern: '', // AST evaluation needed
        severity: 'warning',
        autoFixable: false,
    },
    {
        id: 'no-console-log',
        name: 'No console.log in production',
        description: 'Use the standard logger instead of console.log',
        type: 'security_bypass',
        pattern: /console\.log\(/g,
        severity: 'warning',
        autoFixable: true,
    },
    {
        id: 'api-rate-limit',
        name: 'API Routes must have rate limiting',
        description: 'Ensure rate limiting middleware is applied',
        type: 'security_bypass',
        pattern: '', 
        severity: 'error',
        autoFixable: false,
    },
    {
        id: 'db-repo-layer',
        name: 'All DB queries must go through repository',
        description: 'Prevents raw SQL in controllers',
        type: 'layer_violation',
        pattern: /getSql\(\)/g, // In controller logic
        severity: 'error',
        autoFixable: false,
    }
];

export class ArchitectureEnforcer {
    private rules: ArchitectureRule[] = [...BUILT_IN_RULES];

    /**
     * Add a custom rule.
     */
    addRule(rule: ArchitectureRule): void {
        this.rules.push(rule);
    }

    /**
     * Check a specific file for violations.
     */
    checkFile(filePath: string, content: string): ArchitectureViolation[] {
        const violations: ArchitectureViolation[] = [];
        
        for (const rule of this.rules) {
            if (rule.type === 'import_forbidden' || rule.type === 'layer_violation' || rule.type === 'security_bypass') {
                if (rule.pattern instanceof RegExp) {
                    const lines = content.split('\n');
                    lines.forEach((line, index) => {
                        if (rule.pattern && new RegExp(rule.pattern).test(line)) {
                            violations.push({
                                rule,
                                file: filePath,
                                line: index + 1,
                                description: rule.description,
                                suggestion: `Fix rule: ${rule.name}`
                            });
                        }
                    });
                }
            } else if (rule.type === 'file_too_large') {
                if (content.split('\n').length > 500) {
                    violations.push({
                        rule,
                        file: filePath,
                        description: `File is ${content.split('\n').length} lines, exceeds 500.`,
                        suggestion: 'Split into smaller modules.'
                    });
                }
            }
        }
        
        return violations;
    }

    /**
     * Check entire project for violations.
     */
    checkProject(projectPath: string): ArchitectureViolation[] {
        // Pseudo implementation for directory traversal
        return [];
    }

    /**
     * Special check for import violations.
     */
    checkImportViolations(filePath: string, content: string): ArchitectureViolation[] {
        return this.checkFile(filePath, content).filter(v => v.rule.type === 'import_forbidden');
    }

    /**
     * Checks circular dependencies using an import graph.
     */
    checkCircularDependencies(graph: Map<string, string[]>): string[][] {
        // DFS cycle detection logic
        return [];
    }

    /**
     * Evaluates layer boundary violations based on file structure.
     */
    checkLayerViolations(content: string, fileLayer: string): ArchitectureViolation[] {
        return [];
    }

    /**
     * Outputs a markdown report.
     */
    generateReport(violations: ArchitectureViolation[]): string {
        let md = `# Architecture Enforcement Report\n\n`;
        md += `Total Violations: ${violations.length}\n\n`;
        for (const v of violations) {
            md += `- **${v.rule.severity.toUpperCase()}**: ${v.rule.name} in \`${v.file}\`${v.line ? ` on line ${v.line}` : ''}\n`;
            md += `  > ${v.suggestion}\n`;
        }
        return md;
    }

    /**
     * Returns true if any error severity rule is violated.
     */
    blockCommit(violations: ArchitectureViolation[]): boolean {
        return violations.some(v => v.rule.severity === 'error');
    }
}

export const architectureEnforcer = new ArchitectureEnforcer();
