import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

export interface DependencyRisk {
  name: string;
  version: string;
  riskScore: number;
  riskFactors: DependencyRiskFactor[];
  alternatives: string[];
  recommendation: 'safe' | 'caution' | 'avoid';
  lastSecurityAudit?: Date;
}

export interface DependencyRiskFactor {
  factor: 'low_maintenance' | 'high_vulnerabilities' | 'large_size' | 'breaking_updates' | 'low_adoption' | 'license_risk' | 'abandoned';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
}

/**
 * Predicts and analyzes supply-chain and maintenance risks of dependencies.
 */
export class DependencyRiskPredictor {
  /**
   * Computes an overall risk score and recommendation for a specific package.
   */
  public async predict(name: string, version: string): Promise<DependencyRisk> {
    try {
      logger.info(`Predicting risk for ${name}@${version}`);
      
      const riskFactors: DependencyRiskFactor[] = [];
      let riskScore = 0;

      const maintRisk = await this.analyzeMaintenanceHealth(name);
      if (maintRisk) {
        riskFactors.push(maintRisk);
        riskScore += maintRisk.severity === 'high' ? 40 : 20;
      }

      const vulnRisk = await this.checkHistoricalVulnerabilities(name);
      if (vulnRisk) {
        riskFactors.push(vulnRisk);
        riskScore += 50;
      }

      const licenseRisk = await this.checkLicense(name);
      if (licenseRisk) {
        riskFactors.push(licenseRisk);
        riskScore += 30;
      }

      let recommendation: 'safe' | 'caution' | 'avoid' = 'safe';
      if (riskScore >= 70) recommendation = 'avoid';
      else if (riskScore >= 30) recommendation = 'caution';

      return {
        name,
        version,
        riskScore: Math.min(riskScore, 100),
        riskFactors,
        alternatives: recommendation === 'avoid' ? ['alternative-pkg-1', 'alternative-pkg-2'] : [],
        recommendation,
        lastSecurityAudit: new Date()
      };
    } catch (error) {
      logger.error(`Error predicting risk for ${name}`, error);
      throw new Error(`Risk prediction failed for ${name}`);
    }
  }

  /**
   * Scans a package.json file and evaluates all dependencies.
   */
  public async scanPackageJson(packageJsonPath: string): Promise<DependencyRisk[]> {
    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      const risks: DependencyRisk[] = [];
      for (const [name, version] of Object.entries(deps)) {
        const risk = await this.predict(name, version as string);
        risks.push(risk);
      }
      return risks;
    } catch (error) {
      logger.error('Failed to scan package.json', error);
      throw new Error('Package scan failed');
    }
  }

  public async analyzeMaintenanceHealth(name: string): Promise<DependencyRiskFactor | null> {
    // Mock logic: randomly flag some packages
    if (name.includes('legacy')) {
      return { factor: 'abandoned', severity: 'high', description: 'Package has not been updated in over 2 years.' };
    }
    return null;
  }

  public async checkHistoricalVulnerabilities(name: string): Promise<DependencyRiskFactor | null> {
    // Mock logic
    if (name === 'lodash') {
      return { factor: 'high_vulnerabilities', severity: 'medium', description: 'Package has a history of prototype pollution vulnerabilities.' };
    }
    return null;
  }

  public async checkLicense(name: string): Promise<DependencyRiskFactor | null> {
    if (name.includes('gpl')) {
      return { factor: 'license_risk', severity: 'high', description: 'Viral license may not be compatible with proprietary codebases.' };
    }
    return null;
  }

  public async predictBreakingChanges(name: string, currentVersion: string, targetVersion: string): Promise<boolean> {
    // If major version changed
    const currMajor = currentVersion.replace(/[^0-9.]/g, '').split('.')[0];
    const targetMajor = targetVersion.replace(/[^0-9.]/g, '').split('.')[0];
    return currMajor !== targetMajor;
  }

  /**
   * Generates a formatted markdown report of dependency risks.
   */
  public generateReport(risks: DependencyRisk[]): string {
    let md = '# Dependency Risk Report\n\n| Package | Version | Score | Recommendation | Risks |\n|---|---|---|---|---|\n';
    
    for (const r of risks.sort((a, b) => b.riskScore - a.riskScore)) {
      const factors = r.riskFactors.map(f => f.factor).join(', ') || 'None';
      md += `| ${r.name} | ${r.version} | ${r.riskScore}/100 | **${r.recommendation.toUpperCase()}** | ${factors} |\n`;
    }
    
    return md;
  }
}

export const dependencyRiskPredictor = new DependencyRiskPredictor();
