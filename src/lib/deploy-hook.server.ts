/** رابط خطّاف النشر على كونتابو مع قيم افتراضية حتى لو لم يُضبط PLATFORM_DEPLOY_URL. */
export function deployHookUrl(): string {
  return "http://127.0.0.1:8790/deploy";
}

/** يبني نقطة نهاية أخرى على نفس الخطّاف (status / domain …). */
export function deployHookEndpoint(path: string): string {
  return deployHookUrl().replace(/\/deploy\/?$/, path.startsWith("/") ? path : `/${path}`);
}
