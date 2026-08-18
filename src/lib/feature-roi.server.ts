import { logger } from '@/lib/logger';

export interface FeatureROI {
  featureId: string;
  name: string;
  developmentCostHours: number;
  maintenanceCostMonthly: number;
  revenueImpact: number;
  userRetentionImpact: number;
  roi: number;
  paybackMonths: number;
  recommendation: 'build' | 'defer' | 'kill';
}

export interface FeatureEstimate {
  featureId: string;
  name: string;
  estimatedHours: number;
  teamCostPerHour: number;
  expectedUsers: number;
  conversionImpact: number;
  monthlyMaintenanceHours?: number;
}

/**
 * Evaluates the Return on Investment (ROI) for software features.
 */
export class FeatureROICalculator {
  /**
   * Calculates the ROI of a specific feature.
   * @param feature Feature estimation details.
   * @returns Calculated FeatureROI object.
   */
  public calculate(feature: FeatureEstimate): FeatureROI {
    try {
      const devCost = feature.estimatedHours * feature.teamCostPerHour;
      const maintenanceHours = feature.monthlyMaintenanceHours || (feature.estimatedHours * 0.1);
      const maintenanceCostMonthly = maintenanceHours * feature.teamCostPerHour;
      
      // Basic heuristic: impact value per user conversion
      const assumedValuePerConversion = 50; 
      const monthlyRevenueImpact = feature.expectedUsers * (feature.conversionImpact / 100) * assumedValuePerConversion;
      
      // Calculate 1-year ROI
      const annualRevenue = monthlyRevenueImpact * 12;
      const annualCost = devCost + (maintenanceCostMonthly * 12);
      
      const roi = annualCost > 0 ? ((annualRevenue - annualCost) / annualCost) * 100 : 0;
      
      // Calculate payback months
      const netMonthlyCashflow = monthlyRevenueImpact - maintenanceCostMonthly;
      const paybackMonths = netMonthlyCashflow > 0 ? devCost / netMonthlyCashflow : Infinity;
      
      let recommendation: 'build' | 'defer' | 'kill' = 'kill';
      if (roi > 200 && paybackMonths < 6) {
        recommendation = 'build';
      } else if (roi > 50) {
        recommendation = 'defer';
      }

      return {
        featureId: feature.featureId,
        name: feature.name,
        developmentCostHours: feature.estimatedHours,
        maintenanceCostMonthly,
        revenueImpact: monthlyRevenueImpact,
        userRetentionImpact: feature.conversionImpact,
        roi,
        paybackMonths,
        recommendation
      };
    } catch (error) {
      logger.error(`Error calculating ROI for feature ${feature.name}`, error);
      throw new Error('ROI calculation failed');
    }
  }

  /**
   * Sorts and compares multiple features based on their calculated ROI.
   * @param features Array of calculated FeatureROIs.
   * @returns Sorted array of features (highest ROI first).
   */
  public compareFeatures(features: FeatureROI[]): FeatureROI[] {
    return [...features].sort((a, b) => b.roi - a.roi);
  }

  /**
   * Returns the payback period in months.
   * @param roi FeatureROI object.
   * @returns Payback months.
   */
  public calculatePayback(roi: FeatureROI): number {
    return roi.paybackMonths;
  }

  /**
   * Analyzes historically retired features to see if the decision was optimal.
   * @param retiredFeatures Array of previously retired features' ROIs.
   * @returns A summary object indicating if retirement saved resources.
   */
  public analyzeRetired(retiredFeatures: FeatureROI[]): { costSaved: number; missedRevenue: number; wasCorrect: boolean } {
    try {
      let costSaved = 0;
      let missedRevenue = 0;

      for (const feature of retiredFeatures) {
        costSaved += feature.maintenanceCostMonthly * 12; // Assuming 1 year savings
        missedRevenue += feature.revenueImpact * 12;
      }

      return {
        costSaved,
        missedRevenue,
        wasCorrect: costSaved > missedRevenue
      };
    } catch (error) {
      logger.error('Error analyzing retired features', error);
      throw new Error('Retirement analysis failed');
    }
  }

  /**
   * Generates a markdown report recommending actions for a list of features.
   * @param features Evaluated features.
   * @returns Markdown string.
   */
  public generateReport(features: FeatureROI[]): string {
    const sorted = this.compareFeatures(features);
    let md = '# Feature ROI Analysis & Recommendations\n\n';
    md += '| Feature | ROI (%) | Payback (Months) | Recommendation |\n|---|---|---|---|\n';
    for (const f of sorted) {
      md += `| ${f.name} | ${f.roi.toFixed(1)}% | ${f.paybackMonths === Infinity ? 'Never' : f.paybackMonths.toFixed(1)} | **${f.recommendation.toUpperCase()}** |\n`;
    }
    return md;
  }
}

export const featureROICalculator = new FeatureROICalculator();
