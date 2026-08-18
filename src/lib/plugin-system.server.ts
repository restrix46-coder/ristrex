/**
 * Plugin System — src/lib/plugin-system.server.ts
 *
 * يتيح إضافة Agents/Tools/Integrations بدون تعديل Core System.
 * معمارية Plugin/Adapter/Interface قابلة للتوسع.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  type: "agent" | "tool" | "integration" | "provider" | "middleware";
  capabilities: string[];
  dependencies: string[];
  permissions: string[];
  config?: Record<string, unknown>;
  enabled: boolean;
}

export interface ToolPlugin {
  manifest: PluginManifest;
  execute: (input: unknown, context: PluginContext) => Promise<unknown>;
  validate?: (input: unknown) => boolean;
  schema?: { input: Record<string, unknown>; output: Record<string, unknown> };
}

export interface AgentPlugin {
  manifest: PluginManifest;
  createAgent: () => { run: (task: string, context: PluginContext) => Promise<string> };
}

export interface ProviderPlugin {
  manifest: PluginManifest;
  createClient: (config: Record<string, unknown>) => unknown;
}

export interface PluginContext {
  projectId?: string;
  userId?: string;
  environment: string;
  secrets: Record<string, string>;
  logger: typeof logger;
}

export type Plugin = ToolPlugin | AgentPlugin | ProviderPlugin;

// ─── PluginRegistry ────────────────────────────────────────────────────────

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();
  private manifests = new Map<string, PluginManifest>();

  /**
   * يُسجّل plugin جديد
   */
  register(plugin: Plugin): void {
    const { id, name, type } = plugin.manifest;

    if (this.plugins.has(id)) {
      logger.warn("Plugin already registered — overwriting", { id, name });
    }

    this.plugins.set(id, plugin);
    this.manifests.set(id, plugin.manifest);
    logger.info("Plugin registered", { id, name, type });
  }

  /**
   * يُلغي تسجيل plugin
   */
  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
    this.manifests.delete(pluginId);
    logger.info("Plugin unregistered", { pluginId });
  }

  /**
   * يُرجع plugin بـ ID
   */
  get(pluginId: string): Plugin | null {
    return this.plugins.get(pluginId) ?? null;
  }

  /**
   * يُرجع جميع plugins من نوع معين
   */
  getByType(type: PluginManifest["type"]): Plugin[] {
    return [...this.plugins.values()].filter((p) => p.manifest.type === type && p.manifest.enabled);
  }

  /**
   * يُرجع جميع الـ manifests
   */
  list(): PluginManifest[] {
    return [...this.manifests.values()];
  }

  /**
   * يُنفّذ tool plugin
   */
  async executeTool(pluginId: string, input: unknown, context: PluginContext): Promise<unknown> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin '${pluginId}' not found`);
    if (plugin.manifest.type !== "tool") throw new Error(`Plugin '${pluginId}' is not a tool`);

    const toolPlugin = plugin as ToolPlugin;

    if (toolPlugin.validate && !toolPlugin.validate(input)) {
      throw new Error(`Invalid input for plugin '${pluginId}'`);
    }

    logger.info("Executing tool plugin", { pluginId });
    return toolPlugin.execute(input, context);
  }

  /**
   * يتحقق من تعارض الـ Permissions
   */
  checkPermissions(pluginId: string, requiredPermissions: string[]): boolean {
    const manifest = this.manifests.get(pluginId);
    if (!manifest) return false;
    return requiredPermissions.every((p) => manifest.permissions.includes(p));
  }

  /**
   * يُولّد تقرير الـ plugins المثبتة
   */
  generateReport(): string {
    const plugins = this.list();
    const byType = plugins.reduce(
      (acc, p) => {
        acc[p.type] = (acc[p.type] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const lines = [
      `# Plugin Registry Report`,
      `Total: ${plugins.length} plugins`,
      ``,
      ...Object.entries(byType).map(([type, count]) => `- ${type}: ${count}`),
      ``,
      `## Installed Plugins`,
      ...plugins.map((p) => `- [${p.enabled ? "✅" : "❌"}] ${p.name} v${p.version} (${p.type})`),
    ];

    return lines.join("\n");
  }
}

// ─── Built-in Plugin Helpers ───────────────────────────────────────────────

/**
 * يُنشئ Tool Plugin بسهولة
 */
export function createToolPlugin(
  manifest: Omit<PluginManifest, "type">,
  execute: ToolPlugin["execute"],
  options?: { validate?: ToolPlugin["validate"]; schema?: ToolPlugin["schema"] },
): ToolPlugin {
  return {
    manifest: { ...manifest, type: "tool" },
    execute,
    ...options,
  };
}

/**
 * يُنشئ Agent Plugin بسهولة
 */
export function createAgentPlugin(
  manifest: Omit<PluginManifest, "type">,
  factory: AgentPlugin["createAgent"],
): AgentPlugin {
  return {
    manifest: { ...manifest, type: "agent" },
    createAgent: factory,
  };
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const pluginRegistry = new PluginRegistry();
