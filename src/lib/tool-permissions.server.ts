/**
 * Tool Permission Engine — src/lib/tool-permissions.server.ts
 *
 * يُطبّق مبدأ Least Privilege على الأدوات:
 * - كل Agent يحصل فقط على الأدوات التي يحتاجها
 * - كل أداة تحتاج ALLOW/DENY/ASK_USER صريح
 * - الإجراءات الخطرة (Delete/Deploy/Payment) تتطلب موافقة المستخدم
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ───────────────────────────────────────────────────────────────

export type ToolPermission = "ALLOW" | "DENY" | "ASK_USER";
export type RiskLevel = "safe" | "moderate" | "dangerous" | "critical";

export interface ToolDefinition {
  name: string;
  description: string;
  riskLevel: RiskLevel;
  defaultPermission: ToolPermission;
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
}

export interface AgentToolPolicy {
  agentType: AgentType;
  allowedTools: string[];
  deniedTools: string[];
  askUserTools: string[];
}

export type AgentType =
  | "requirements"
  | "architect"
  | "frontend"
  | "backend"
  | "database"
  | "testing"
  | "security"
  | "performance"
  | "devops"
  | "deployment"
  | "monitoring"
  | "browser_qa"
  | "documentation"
  | "orchestrator";

// ─── تعريف جميع الأدوات ────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  // 📖 أدوات القراءة (آمنة)
  read_file: { name: "read_file", description: "قراءة ملف", riskLevel: "safe", defaultPermission: "ALLOW" },
  list_files: { name: "list_files", description: "قائمة الملفات", riskLevel: "safe", defaultPermission: "ALLOW" },
  search_code: { name: "search_code", description: "البحث في الكود", riskLevel: "safe", defaultPermission: "ALLOW" },
  get_memory: { name: "get_memory", description: "قراءة الذاكرة", riskLevel: "safe", defaultPermission: "ALLOW" },
  http_get: { name: "http_get", description: "طلب HTTP GET", riskLevel: "safe", defaultPermission: "ALLOW" },
  research: { name: "research", description: "بحث إنترنت", riskLevel: "safe", defaultPermission: "ALLOW" },

  // ✏️ أدوات الكتابة (متوسطة)
  write_file: { name: "write_file", description: "كتابة ملف", riskLevel: "moderate", defaultPermission: "ALLOW" },
  edit_file: { name: "edit_file", description: "تعديل ملف", riskLevel: "moderate", defaultPermission: "ALLOW" },
  save_memory: { name: "save_memory", description: "حفظ في الذاكرة", riskLevel: "moderate", defaultPermission: "ALLOW" },
  http_post: { name: "http_post", description: "طلب HTTP POST", riskLevel: "moderate", defaultPermission: "ALLOW" },

  // 💻 أدوات التنفيذ (خطرة)
  run_command: {
    name: "run_command", description: "تشغيل أمر Shell",
    riskLevel: "dangerous", defaultPermission: "ALLOW",
    requiresConfirmation: false, // مسموح بدون موافقة في sandbox
  },
  run_tests: { name: "run_tests", description: "تشغيل الاختبارات", riskLevel: "moderate", defaultPermission: "ALLOW" },
  browser_action: { name: "browser_action", description: "تفاعل مع المتصفح", riskLevel: "moderate", defaultPermission: "ALLOW" },
  take_screenshot: { name: "take_screenshot", description: "لقطة شاشة", riskLevel: "safe", defaultPermission: "ALLOW" },

  // 🗑️ أدوات الحذف (تطلب موافقة)
  delete_file: {
    name: "delete_file", description: "حذف ملف",
    riskLevel: "dangerous", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "هل تريد حذف الملف {target}؟ هذا الإجراء لا يمكن التراجع عنه.",
  },
  delete_database_record: {
    name: "delete_database_record", description: "حذف سجل من قاعدة البيانات",
    riskLevel: "dangerous", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "هل تريد حذف السجل {id} من جدول {table}؟",
  },
  drop_table: {
    name: "drop_table", description: "حذف جدول قاعدة بيانات",
    riskLevel: "critical", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "⚠️ تحذير: حذف الجدول {table} سيؤدي إلى فقدان البيانات! هل أنت متأكد؟",
  },

  // 🚀 أدوات النشر (تطلب موافقة)
  deploy_production: {
    name: "deploy_production", description: "النشر في بيئة الإنتاج",
    riskLevel: "critical", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "🚀 هل تريد نشر الإصدار {version} في بيئة الإنتاج؟",
  },
  run_migration: {
    name: "run_migration", description: "تشغيل migration قاعدة البيانات",
    riskLevel: "dangerous", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "هل تريد تشغيل migration {name}؟ تأكد من وجود backup.",
  },

  // 💳 أدوات الدفع (تطلب موافقة دائماً)
  charge_payment: {
    name: "charge_payment", description: "تحصيل دفع",
    riskLevel: "critical", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "💳 تحصيل {amount} {currency} من {customer}؟",
  },
  refund_payment: {
    name: "refund_payment", description: "استرداد دفع",
    riskLevel: "critical", defaultPermission: "ASK_USER",
    requiresConfirmation: true,
    confirmationMessage: "💸 استرداد {amount} للعميل {customer}؟",
  },
};

// ─── سياسات الوكلاء ────────────────────────────────────────────────────────

export const AGENT_POLICIES: Record<AgentType, AgentToolPolicy> = {
  requirements: {
    agentType: "requirements",
    allowedTools: ["read_file", "list_files", "get_memory", "save_memory", "research", "http_get"],
    deniedTools: ["delete_file", "deploy_production", "drop_table", "charge_payment", "run_command"],
    askUserTools: [],
  },
  architect: {
    agentType: "architect",
    allowedTools: ["read_file", "list_files", "search_code", "get_memory", "save_memory", "research", "write_file"],
    deniedTools: ["delete_file", "deploy_production", "drop_table", "charge_payment"],
    askUserTools: ["run_migration"],
  },
  frontend: {
    agentType: "frontend",
    allowedTools: ["read_file", "write_file", "edit_file", "list_files", "search_code", "run_command", "run_tests", "take_screenshot", "browser_action"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment", "delete_database_record"],
    askUserTools: ["delete_file"],
  },
  backend: {
    agentType: "backend",
    allowedTools: ["read_file", "write_file", "edit_file", "list_files", "search_code", "run_command", "run_tests", "http_post", "http_get"],
    deniedTools: ["deploy_production", "charge_payment"],
    askUserTools: ["delete_file", "run_migration", "delete_database_record"],
  },
  database: {
    agentType: "database",
    allowedTools: ["read_file", "write_file", "list_files", "search_code", "run_command"],
    deniedTools: ["deploy_production", "charge_payment"],
    askUserTools: ["delete_file", "run_migration", "delete_database_record", "drop_table"],
  },
  testing: {
    agentType: "testing",
    allowedTools: ["read_file", "write_file", "list_files", "search_code", "run_tests", "run_command", "take_screenshot", "browser_action"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment"],
    askUserTools: ["delete_file"],
  },
  security: {
    agentType: "security",
    allowedTools: ["read_file", "list_files", "search_code", "run_command", "http_get", "research"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment", "http_post"],
    askUserTools: ["delete_file"],
  },
  performance: {
    agentType: "performance",
    allowedTools: ["read_file", "list_files", "search_code", "run_command", "take_screenshot", "browser_action"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment"],
    askUserTools: [],
  },
  devops: {
    agentType: "devops",
    allowedTools: ["read_file", "write_file", "edit_file", "list_files", "run_command", "http_get", "http_post"],
    deniedTools: ["charge_payment", "drop_table"],
    askUserTools: ["deploy_production", "run_migration"],
  },
  deployment: {
    agentType: "deployment",
    allowedTools: ["read_file", "list_files", "run_command", "http_get"],
    deniedTools: ["charge_payment", "drop_table", "delete_database_record"],
    askUserTools: ["deploy_production", "run_migration", "delete_file"],
  },
  monitoring: {
    agentType: "monitoring",
    allowedTools: ["read_file", "list_files", "http_get", "get_memory", "take_screenshot"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment", "delete_file", "delete_database_record", "run_command"],
    askUserTools: [],
  },
  browser_qa: {
    agentType: "browser_qa",
    allowedTools: ["browser_action", "take_screenshot", "http_get", "read_file"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment", "delete_file", "delete_database_record"],
    askUserTools: [],
  },
  documentation: {
    agentType: "documentation",
    allowedTools: ["read_file", "write_file", "list_files", "search_code", "get_memory"],
    deniedTools: ["deploy_production", "drop_table", "charge_payment", "delete_database_record", "run_command"],
    askUserTools: ["delete_file"],
  },
  orchestrator: {
    agentType: "orchestrator",
    allowedTools: Object.keys(TOOL_REGISTRY),
    deniedTools: [],
    askUserTools: ["deploy_production", "drop_table", "charge_payment", "refund_payment"],
  },
};

// ─── محرك الصلاحيات ────────────────────────────────────────────────────────

export class ToolPermissionEngine {
  /**
   * يتحقق من صلاحية وكيل لاستخدام أداة
   */
  check(agentType: AgentType, toolName: string): ToolPermission {
    const policy = AGENT_POLICIES[agentType];
    if (!policy) {
      logger.warn("Unknown agent type — denying tool access", { agentType, toolName });
      return "DENY";
    }

    if (policy.deniedTools.includes(toolName)) return "DENY";
    if (policy.askUserTools.includes(toolName)) return "ASK_USER";
    if (policy.allowedTools.includes(toolName) || policy.allowedTools.includes("*")) return "ALLOW";

    // Default: deny إن لم تكن مدرجة
    return "DENY";
  }

  /**
   * يُرجع قائمة الأدوات المسموحة لوكيل معين
   */
  getAllowedTools(agentType: AgentType): string[] {
    const policy = AGENT_POLICIES[agentType];
    if (!policy) return [];
    return policy.allowedTools.filter((t) => !policy.deniedTools.includes(t));
  }

  /**
   * يتحقق ويُسجّل ويرمي خطأ عند الرفض
   */
  enforce(agentType: AgentType, toolName: string): void {
    const permission = this.check(agentType, toolName);
    if (permission === "DENY") {
      logger.warn("Tool access denied", { agentType, toolName });
      throw new ToolPermissionError(agentType, toolName);
    }
    if (permission === "ASK_USER") {
      logger.info("Tool requires user confirmation", { agentType, toolName });
      throw new ToolRequiresConfirmationError(agentType, toolName);
    }
  }
}

// ─── أخطاء الصلاحيات ─────────────────────────────────────────────────────

export class ToolPermissionError extends Error {
  public readonly statusCode = 403;
  constructor(agentType: string, toolName: string) {
    super(`Agent '${agentType}' is not allowed to use tool '${toolName}'`);
    this.name = "ToolPermissionError";
  }
}

export class ToolRequiresConfirmationError extends Error {
  public readonly statusCode = 428;
  constructor(agentType: string, toolName: string) {
    super(`Tool '${toolName}' requires user confirmation before agent '${agentType}' can use it`);
    this.name = "ToolRequiresConfirmationError";
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const toolPermissions = new ToolPermissionEngine();
