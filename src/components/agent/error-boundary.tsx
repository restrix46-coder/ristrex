/**
 * error-boundary.tsx — مكونات ErrorBoundary للحماية من أخطاء التصيير.
 *
 * ✅ يمنع انهيار التطبيق بالكامل عند فشل مكوّن واحد.
 * ✅ يعرض واجهة احترافية للمستخدم بدلاً من شاشة بيضاء.
 * ✅ يدعم الاسترداد التلقائي (retry).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** نص رسالة الخطأ المخصصة للمستخدم */
  fallbackMessage?: string;
  /** معالج اختياري لتسجيل الأخطاء */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** هل تعرض تفاصيل الخطأ في وضع التطوير */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * مكوّن ErrorBoundary عام — غلّف به أي جزء من الواجهة حيث
 * خطأ التصيير يجب ألا يُسقط الصفحة بأكملها.
 *
 * @example
 * <ErrorBoundary fallbackMessage="فشل تحميل لوحة المشروع">
 *   <ProjectPanel />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // استدعاء المعالج الخارجي إن وُجد
    this.props.onError?.(error, info);

    // تسجيل في console للتطوير
    if (process.env["NODE_ENV"] !== "production") {
      console.error("[ErrorBoundary] خطأ في التصيير:", error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const isDev = process.env["NODE_ENV"] !== "production";
    const showDetails = this.props.showDetails ?? isDev;
    const message = this.props.fallbackMessage ?? "حدث خطأ في عرض هذا المكوّن";

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center"
      >
        <AlertTriangle className="size-8 text-destructive/70" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">{message}</p>
          {showDetails && this.state.error && (
            <p className="max-w-md text-xs text-muted-foreground font-mono break-all">
              {this.state.error.message}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={this.handleRetry}
          className="gap-2"
        >
          <RefreshCw className="size-3.5" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }
}

/**
 * نسخة خفيفة صامتة — تُخفي المكوّن الفاشل بدون رسالة ظاهرة.
 * مناسب للعناصر الثانوية التي لا تؤثر جوهرياً على تجربة المستخدم.
 */
export class SilentErrorBoundary extends Component<
  { children: ReactNode; onError?: (e: Error) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onError?: (e: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
    if (process.env["NODE_ENV"] !== "production") {
      console.warn("[SilentErrorBoundary]", error.message);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
