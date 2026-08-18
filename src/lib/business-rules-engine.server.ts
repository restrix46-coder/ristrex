import { randomUUID } from 'crypto';

export interface RuleCondition {
  type: 'simple' | 'and' | 'or' | 'not';
  field?: string;
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'matches';
  value?: unknown;
  conditions?: RuleCondition[];
}

export interface RuleAction {
  type: 'set' | 'validate' | 'calculate' | 'notify' | 'reject' | 'transform';
  field?: string;
  value?: unknown;
  message?: string;
}

export interface BusinessRule {
  id: string;
  name: string;
  description: string;
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
  enabled: boolean;
  category: string;
}

export interface RuleResult {
  passed: boolean;
  appliedRules: string[];
  rejectedRules: string[];
  errors: string[];
  transformedData: object;
}

export class BusinessRulesEngine {
  private rules: Map<string, BusinessRule> = new Map();

  /**
   * Registers a new business rule
   * @param rule The business rule to register
   */
  public register(rule: BusinessRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Evaluates context against rules
   * @param context The data context
   * @param category Optional category to filter rules
   */
  public evaluate(context: object, category?: string): RuleResult {
    const rulesToRun = this.getActiveRules(category).sort((a, b) => b.priority - a.priority);
    
    const result: RuleResult = {
      passed: true,
      appliedRules: [],
      rejectedRules: [],
      errors: [],
      transformedData: { ...context }
    };

    for (const rule of rulesToRun) {
      if (this.evaluateCondition(rule.condition, result.transformedData)) {
        result.appliedRules.push(rule.id);
        this.applyAction(rule.action, result);
      } else {
        result.rejectedRules.push(rule.id);
      }
    }

    return result;
  }

  /**
   * Validates data against specific rules
   */
  public validate(data: object, rules: string[]): { valid: boolean; errors: string[] } {
    const result = { valid: true, errors: [] as string[] };
    
    for (const ruleId of rules) {
      const rule = this.rules.get(ruleId);
      if (!rule) continue;

      if (!this.evaluateCondition(rule.condition, data)) {
        result.valid = false;
        result.errors.push(`Validation failed for rule: ${rule.name}`);
      }
    }

    return result;
  }

  /**
   * Extremely simple calculator based on formula string
   */
  public calculate(data: Record<string, any>, formula: string): number {
    try {
      // UNSAFE eval for demonstration; in production use a safe math parser
      const parsedFormula = formula.replace(/[a-zA-Z_]+/g, match => {
        return data[match] !== undefined ? data[match] : match;
      });
      return Function(`"use strict";return (${parsedFormula})`)();
    } catch (e) {
      return 0;
    }
  }

  /**
   * Gets active rules optionally filtered by category
   */
  public getActiveRules(category?: string): BusinessRule[] {
    const allRules = Array.from(this.rules.values()).filter(r => r.enabled);
    if (category) {
      return allRules.filter(r => r.category === category);
    }
    return allRules;
  }

  private evaluateCondition(condition: RuleCondition, data: any): boolean {
    if (condition.type === 'and' && condition.conditions) {
      return condition.conditions.every(c => this.evaluateCondition(c, data));
    }
    if (condition.type === 'or' && condition.conditions) {
      return condition.conditions.some(c => this.evaluateCondition(c, data));
    }
    if (condition.type === 'not' && condition.conditions && condition.conditions.length > 0) {
      return !this.evaluateCondition(condition.conditions[0], data);
    }
    
    if (condition.type === 'simple' && condition.field) {
      const fieldValue = this.getFieldValue(data, condition.field);
      return this.compare(fieldValue, condition.operator, condition.value);
    }
    
    return true; // Default fallback
  }

  private compare(fieldValue: any, operator: string | undefined, expectedValue: any): boolean {
    switch (operator) {
      case 'eq': return fieldValue === expectedValue;
      case 'ne': return fieldValue !== expectedValue;
      case 'gt': return fieldValue > expectedValue;
      case 'lt': return fieldValue < expectedValue;
      case 'gte': return fieldValue >= expectedValue;
      case 'lte': return fieldValue <= expectedValue;
      case 'in': return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
      case 'contains': return Array.isArray(fieldValue) && fieldValue.includes(expectedValue);
      case 'matches': return new RegExp(expectedValue).test(fieldValue);
      default: return false;
    }
  }

  private applyAction(action: RuleAction, result: RuleResult): void {
    if (action.type === 'reject') {
      result.passed = false;
      if (action.message) result.errors.push(action.message);
    } else if (action.type === 'set' && action.field) {
      this.setFieldValue(result.transformedData, action.field, action.value);
    }
    // Implement other actions as needed
  }

  private getFieldValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  private setFieldValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop();
    if (!last) return;
    const target = parts.reduce((acc, part) => {
      if (!acc[part]) acc[part] = {};
      return acc[part];
    }, obj);
    target[last] = value;
  }
}

export const businessRules = new BusinessRulesEngine();
