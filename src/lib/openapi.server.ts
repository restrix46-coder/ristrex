/**
 * OpenAPI Documentation Generator — src/lib/openapi.server.ts
 *
 * يُولّد مستند OpenAPI 3.1 لجميع API endpoints الخاصة بـ Weaver.
 *
 * الوصول: GET /api/openapi.json
 * Swagger UI: GET /api/docs
 */

export function generateOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Weaver API",
      version: "1.0.0",
      description:
        "منصة Weaver للذكاء الاصطناعي — توثيق API الكامل",
      contact: {
        name: "Weaver Support",
        url: "https://weaver.app/support",
      },
      license: {
        name: "Proprietary",
      },
    },
    servers: [
      {
        url: process.env["PUBLIC_URL"] ?? "https://weaver.app",
        description: "Production Server",
      },
      {
        url: "http://localhost:3000",
        description: "Development Server",
      },
    ],
    security: [{ sessionCookie: [] }],
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "weaver_session",
          description: "جلسة مصادقة مشفّرة",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["message"],
          properties: {
            message: { type: "string" },
            code: { type: "string" },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["ok", "degraded", "down"] },
            version: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },
        Project: {
          type: "object",
          required: ["id", "name", "createdAt"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string" },
            status: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Message: {
          type: "object",
          required: ["role", "content"],
          properties: {
            id: { type: "string" },
            role: { type: "string", enum: ["user", "assistant", "system"] },
            content: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        ScanReport: {
          type: "object",
          properties: {
            score: { type: "integer", minimum: 0, maximum: 100 },
            grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
            vulnerabilities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  file: { type: "string" },
                  line: { type: "integer" },
                  message: { type: "string" },
                  fix: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["System"],
          summary: "فحص صحة النظام",
          operationId: "getHealth",
          security: [],
          responses: {
            "200": {
              description: "النظام يعمل بشكل طبيعي",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/HealthResponse" },
                },
              },
            },
          },
        },
      },
      "/api/projects": {
        get: {
          tags: ["Projects"],
          summary: "قائمة المشاريع",
          operationId: "listProjects",
          responses: {
            "200": {
              description: "قائمة المشاريع",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Project" },
                  },
                },
              },
            },
            "401": { description: "غير مصادَق" },
          },
        },
        post: {
          tags: ["Projects"],
          summary: "إنشاء مشروع جديد",
          operationId: "createProject",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "201": { description: "تم إنشاء المشروع" },
            "400": { description: "بيانات غير صالحة" },
            "401": { description: "غير مصادَق" },
          },
        },
      },
      "/api/projects/{projectId}/chat": {
        post: {
          tags: ["Chat"],
          summary: "إرسال رسالة للوكيل",
          operationId: "sendMessage",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["content"],
                  properties: {
                    content: { type: "string" },
                    attachments: { type: "array" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "تدفّق الاستجابة (SSE)" },
          },
        },
      },
      "/api/projects/{projectId}/security-scan": {
        post: {
          tags: ["Security"],
          summary: "فحص أمان المشروع",
          operationId: "runSecurityScan",
          parameters: [
            {
              name: "projectId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            "200": {
              description: "نتيجة الفحص",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ScanReport" },
                },
              },
            },
          },
        },
      },
    },
    tags: [
      { name: "System", description: "نقاط نهاية النظام والمراقبة" },
      { name: "Projects", description: "إدارة المشاريع" },
      { name: "Chat", description: "التواصل مع الوكيل" },
      { name: "Security", description: "فحص الأمان" },
    ],
  };
}

/** يُولّد صفحة Swagger UI HTML */
export function generateSwaggerUiHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>Weaver API Documentation</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
<style>
  body { margin: 0; background: #0f0f0f; }
  .swagger-ui .topbar { display: none; }
  .swagger-ui { font-family: 'Cairo', sans-serif; }
</style>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
SwaggerUIBundle({
  url: "${specUrl}",
  dom_id: "#swagger-ui",
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
  layout: "BaseLayout",
  deepLinking: true,
  tryItOutEnabled: true,
});
</script>
</body>
</html>`;
}
