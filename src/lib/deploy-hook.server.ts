/** رابط خطّاف النشر على كونتابو مع قيم افتراضية حتى لو لم يُضبط PLATFORM_DEPLOY_URL. */
export function deployHookUrl(): string {
  // host.docker.internal يشير للمضيف من داخل Docker
  // 127.0.0.1 داخل Container يشير للـ container نفسه وليس المضيف
  const base = process.env["PLATFORM_DEPLOY_URL"] || "http://host.docker.internal:8790/deploy";
  return base;
}

/** يبني نقطة نهاية أخرى على نفس الخطّاف (status / domain …). */
export function deployHookEndpoint(path: string): string {
  return deployHookUrl().replace(/\/deploy\/?$/, path.startsWith("/") ? path : `/${path}`);
}
