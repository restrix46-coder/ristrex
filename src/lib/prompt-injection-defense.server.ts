import { logger } from '@/lib/logger';

/**
 * Represents a detected prompt injection attempt.
 */
export interface InjectionAttempt {
  detected: boolean;
  type: string;
  confidence: number;
  sanitizedContent: string;
  originalContent: string;
  threats: string[];
}

/**
 * Common injection patterns used by attackers.
 */
export const INJECTION_PATTERNS = [
  { regex: /ignore previous instructions/i, type: 'instruction_bypass' },
  { regex: /you are now|act as|pretend to be/i, type: 'role_confusion' },
  { regex: /system:|assistant:|user:/i, type: 'role_impersonation' },
  { regex: /jailbreak|dan|do anything now/i, type: 'jailbreak' },
  { regex: /write a script to|exec\(|eval\(/i, type: 'code_injection' },
  { regex: /print all previous|reveal your instructions/i, type: 'data_exfiltration' }
];

/**
 * Defense system against prompt injection attacks.
 */
export class PromptInjectionDefender {
  /**
   * Analyzes user input for potential prompt injection patterns.
   * @param userInput The input string from a user.
   * @returns Detailed InjectionAttempt object.
   */
  analyze(userInput: string): InjectionAttempt {
    let detected = false;
    let maxConfidence = 0;
    const threats: string[] = [];
    const detectedTypes = new Set<string>();

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.regex.test(userInput)) {
        detected = true;
        threats.push(`Matched pattern: ${pattern.type}`);
        detectedTypes.add(pattern.type);
        maxConfidence = Math.max(maxConfidence, 0.8); // Simple confidence score
      }
    }

    return {
      detected,
      type: detected ? Array.from(detectedTypes).join(', ') : 'none',
      confidence: maxConfidence,
      sanitizedContent: this.sanitize(userInput, 'user'),
      originalContent: userInput,
      threats
    };
  }

  /**
   * Sanitizes content by neutralizing harmful patterns.
   * @param content The content to sanitize.
   * @param source The source of the content.
   * @returns Sanitized string safe for model consumption.
   */
  sanitize(content: string, source: 'user' | 'web' | 'file' | 'api' | 'email'): string {
    let safeContent = content;
    
    // Replace role markers
    safeContent = safeContent.replace(/(system|assistant|user):/gi, '[Redacted Role]:');
    
    // Neutralize dangerous phrases
    safeContent = safeContent.replace(/ignore previous instructions/gi, '[Ignore Request Dropped]');
    
    return safeContent;
  }

  /**
   * Checks if a source is generally untrusted.
   * @param source The source name.
   * @returns Boolean indicating if the source is untrusted.
   */
  isUntrusted(source: string): boolean {
    const untrusted = ['user', 'web', 'email', 'external_api'];
    return untrusted.includes(source.toLowerCase());
  }

  /**
   * Wraps untrusted content in isolation markers to prevent instruction bleed.
   * @param content The untrusted content.
   * @param source The source identifier.
   * @returns Safely wrapped string.
   */
  wrapUntrustedContent(content: string, source: string): string {
    return `
--- BEGIN UNTRUSTED CONTENT (${source}) ---
${content}
--- END UNTRUSTED CONTENT ---
`;
  }
}

/**
 * Sanitizes tool outputs before feeding them back into the agent context.
 * @param toolName The name of the tool executed.
 * @param output The raw output from the tool.
 * @returns Safe output string.
 */
export function sanitizeToolOutput(toolName: string, output: string): string {
  logger.info(`Sanitizing output for tool: ${toolName}`);
  const defender = new PromptInjectionDefender();
  let sanitized = defender.sanitize(output, 'api');
  return defender.wrapUntrustedContent(sanitized, `tool_${toolName}`);
}
