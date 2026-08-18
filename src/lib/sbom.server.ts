import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface SbomComponent {
  name: string;
  version: string;
  license: string;
  licenseFamily: string;
  isOSS: boolean;
  isVulnerable: boolean;
  vulnerabilities: string[];
  source: 'npm' | 'system';
}

export const ALLOWED_LICENSES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense'];
export const RESTRICTED_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'SSPL-1.0', 'Commons-Clause'];

/**
 * Generate SBOM for project
 * @param projectPath The directory containing package.json
 */
export async function generateSbom(projectPath: string): Promise<SbomComponent[]> {
  try {
    const { stdout } = await execAsync('npm list --json --all', { cwd: projectPath });
    const tree = JSON.parse(stdout);
    
    const components: SbomComponent[] = [];
    
    function parseDeps(deps: any) {
      if (!deps) return;
      for (const [name, info] of Object.entries(deps)) {
        const d = info as any;
        if (d.version) {
          components.push({
            name,
            version: d.version,
            license: 'UNKNOWN', // npm list --json doesn't show license by default, would need full parsing
            licenseFamily: 'UNKNOWN',
            isOSS: true,
            isVulnerable: false,
            vulnerabilities: [],
            source: 'npm'
          });
        }
        if (d.dependencies) {
          parseDeps(d.dependencies);
        }
      }
    }
    
    parseDeps(tree.dependencies);
    return components;
  } catch (error) {
    console.error('Error generating SBOM:', error);
    return [];
  }
}

/**
 * Check license compliance
 * @param components The list of SBOM components
 */
export function checkLicenseCompliance(components: SbomComponent[]) {
  const violations = components.filter(c => RESTRICTED_LICENSES.includes(c.license));
  return {
    compliant: violations.length === 0,
    violations
  };
}

/**
 * Generate SBOM report
 * @param projectPath The project path
 */
export async function generateSbomReport(projectPath: string) {
  const components = await generateSbom(projectPath);
  const compliance = checkLicenseCompliance(components);
  
  return {
    components,
    compliance,
    vulnerabilitiesSummary: components.filter(c => c.isVulnerable).length
  };
}

/**
 * Save SBOM to CycloneDX JSON
 * @param sbom The complete sbom object
 * @param outputPath Write path
 */
export async function saveSbomToFile(sbom: any, outputPath: string): Promise<void> {
  const cycloneDx = {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    components: sbom.components.map((c: SbomComponent) => ({
      type: 'library',
      name: c.name,
      version: c.version,
      licenses: [{ license: { id: c.license } }]
    }))
  };
  
  await fs.writeFile(outputPath, JSON.stringify(cycloneDx, null, 2), 'utf-8');
}
