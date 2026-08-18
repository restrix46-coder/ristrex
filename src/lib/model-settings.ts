import { useCallback, useSyncExternalStore } from "react";

export const STORAGE_KEY = "weaver:gemini-model";
export const DEFAULT_MODEL = "gemini-pro-latest";
const MODEL_CHANGED_EVENT = "weaver:model-changed";

export const MODEL_OPTIONS: { id: string; label: string; note: string }[] = [
  {
    id: "gemini-pro-latest",
    label: "Gemini Pro",
    note: "نموذج قوي للبرمجة والاستدلال العام",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro (Preview)",
    note: "أحدث إصدار تجريبي بقدرات تفكير متقدمة",
  },
  {
    id: "gemini-flash-latest",
    label: "Gemini Flash",
    note: "سريع واقتصادي للمهام البسيطة والسريعة",
  },
];

function readStoredModel() {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  try {
    return window.localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

function subscribeToModel(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(MODEL_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(MODEL_CHANGED_EVENT, onStoreChange);
  };
}

export function useModelSetting() {
  const model = useSyncExternalStore(subscribeToModel, readStoredModel, () => DEFAULT_MODEL);

  const setModel = useCallback((next: string) => {
    const value = next.trim() || DEFAULT_MODEL;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // تظل جلسة المتصفح الحالية قابلة للاستخدام حتى عند منع التخزين المحلي.
    }
    window.dispatchEvent(new Event(MODEL_CHANGED_EVENT));
  }, []);

  return { model, setModel };
}
