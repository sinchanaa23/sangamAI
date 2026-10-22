import { createContext, useContext } from 'react';

export type Workspace = 'buyer' | 'supplier' | 'ecosystem';

export interface Ui {
  openSupplier: (id: string) => void;
  go: (workspace: Workspace, page: string) => void;
  askSangam: (question?: string) => void;
  /** supplier the supplier workspace is acting as */
  actingSeller: string;
  setActingSeller: (id: string) => void;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi() {
  const u = useContext(UiContext);
  if (!u) throw new Error('useUi outside provider');
  return u;
}
