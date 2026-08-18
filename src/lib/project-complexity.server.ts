export type ProjectMode = 'simple' | 'standard' | 'advanced' | 'enterprise';

export interface ComplexityFactors {
    moduleCount: number;
    featureCount: number;
    integrationCount: number;
    dependencyCount: number;
    databaseComplexity: 'simple' | 'moderate' | 'complex';
    securityRisk: 'low' | 'medium' | 'high';
    expectedTraffic: 'low' | 'medium' | 'high' | 'very_high';
    teamSize: number;
    hasMultiTenancy: boolean;
    hasPayments: boolean;
    hasRealtime: boolean;
    hasML: boolean;
}

export interface ComplexityAnalysis {
    mode: ProjectMode;
    score: number;
    factors: ComplexityFactors;
    recommendations: string[];
    requiredArchitecture: string;
    estimatedDevTime: string;
    suggestedTeamSize: number;
    warningFlags: string[];
}

export class ProjectComplexityAnalyzer {
    
    /**
     * Calculate complexity and recommend mode.
     */
    analyze(factors: ComplexityFactors): ComplexityAnalysis {
        let score = 0;
        
        score += factors.moduleCount * 2;
        score += factors.integrationCount * 3;
        
        if (factors.databaseComplexity === 'complex') score += 10;
        if (factors.databaseComplexity === 'moderate') score += 5;
        
        if (factors.expectedTraffic === 'very_high') score += 15;
        if (factors.expectedTraffic === 'high') score += 10;
        
        if (factors.hasMultiTenancy) score += 15;
        if (factors.hasPayments) score += 10;
        if (factors.hasRealtime) score += 5;
        if (factors.hasML) score += 10;

        let mode: ProjectMode = 'simple';
        let requiredArchitecture = 'Monolith';
        let estimatedDevTime = '1-3 months';
        
        if (score <= 25) {
            mode = 'simple';
        } else if (score <= 50) {
            mode = 'standard';
            requiredArchitecture = 'Modular Monolith';
            estimatedDevTime = '3-6 months';
        } else if (score <= 75) {
            mode = 'advanced';
            requiredArchitecture = 'Microservices or Event-Driven';
            estimatedDevTime = '6-12 months';
        } else {
            mode = 'enterprise';
            requiredArchitecture = 'Distributed Microservices';
            estimatedDevTime = '12+ months';
        }

        const recommendations = [];
        if (factors.hasMultiTenancy) recommendations.push('Use row-level security or separate schemas for tenants.');
        if (factors.expectedTraffic === 'very_high') recommendations.push('Implement aggressive caching and read-replicas.');

        return {
            mode,
            score,
            factors,
            recommendations,
            requiredArchitecture,
            estimatedDevTime,
            suggestedTeamSize: Math.max(1, Math.ceil(score / 10)),
            warningFlags: []
        };
    }

    /**
     * Extract factors from a raw text description.
     */
    analyzeFromDescription(description: string): ComplexityAnalysis {
        // Simplistic keyword extraction logic simulating an AI pass
        const lowerDesc = description.toLowerCase();
        
        const factors: ComplexityFactors = {
            moduleCount: 3,
            featureCount: 5,
            integrationCount: lowerDesc.includes('api') ? 2 : 0,
            dependencyCount: 10,
            databaseComplexity: lowerDesc.includes('complex data') ? 'complex' : 'simple',
            securityRisk: lowerDesc.includes('health') || lowerDesc.includes('bank') ? 'high' : 'low',
            expectedTraffic: lowerDesc.includes('millions') ? 'high' : 'low',
            teamSize: 2,
            hasMultiTenancy: lowerDesc.includes('tenant') || lowerDesc.includes('saas'),
            hasPayments: lowerDesc.includes('payment') || lowerDesc.includes('stripe'),
            hasRealtime: lowerDesc.includes('realtime') || lowerDesc.includes('websocket'),
            hasML: lowerDesc.includes('ai') || lowerDesc.includes('machine learning')
        };
        
        return this.analyze(factors);
    }

    /**
     * Analyze complexity from codebase path.
     */
    analyzeFromCodebase(projectPath: string): ComplexityAnalysis {
        // Stub for static analysis logic
        const dummyFactors: ComplexityFactors = {
            moduleCount: 5,
            featureCount: 10,
            integrationCount: 1,
            dependencyCount: 20,
            databaseComplexity: 'moderate',
            securityRisk: 'medium',
            expectedTraffic: 'medium',
            teamSize: 3,
            hasMultiTenancy: false,
            hasPayments: false,
            hasRealtime: false,
            hasML: false
        };
        return this.analyze(dummyFactors);
    }

    /**
     * Recommends a tech stack based on the analysis.
     */
    getRecommendedStack(analysis: ComplexityAnalysis): string {
        switch (analysis.mode) {
            case 'simple': return 'Next.js + SQLite';
            case 'standard': return 'Next.js + PostgreSQL + Redis';
            case 'advanced': return 'Next.js + NestJS + PostgreSQL + Kafka';
            case 'enterprise': return 'Kubernetes + Go/Node microservices + CockroachDB';
        }
    }

    /**
     * Suggests if migration to enterprise is warranted.
     */
    shouldSwitchToEnterpriseMode(analysis: ComplexityAnalysis): boolean {
        return analysis.score > 75 || analysis.factors.expectedTraffic === 'very_high' || analysis.factors.hasMultiTenancy;
    }
}

export const complexityAnalyzer = new ProjectComplexityAnalyzer();
