import { useState, useEffect } from "react";

const STORAGE_KEY = "ppap-view-state";

export interface ViewState {
  submissionId?: string;
  regulationCollectionId?: string;
  findingId?: string;
  documentId?: string;
  chunkId?: string;
  checklistId?: string;
  documentTypeId?: string;
}

const DRAWER_KEYS: (keyof ViewState)[] = [
  "findingId",
  "documentId",
  "chunkId",
  "checklistId",
  "documentTypeId",
];

export function getViewState(): ViewState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ViewState) : {};
  } catch {
    return {};
  }
}

export function setViewState(partial: Partial<ViewState>): void {
  if (typeof window === "undefined") return;
  const current = getViewState();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearDrawerState(): void {
  if (typeof window === "undefined") return;
  const current = getViewState();
  for (const key of DRAWER_KEYS) {
    delete current[key];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function clearViewState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function useViewState(): ViewState {
  const [state, setState] = useState<ViewState>(getViewState);

  useEffect(() => {
    const sync = () => setState(getViewState());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    const interval = setInterval(sync, 500);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      clearInterval(interval);
    };
  }, []);

  return state;
}
