"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

/** Pre-fill data passed when opening the post-transaction modal. */
export interface TransactionPrefill {
  date?: string;
  memo?: string;
  fromAccountCode?: string;
  toAccountCode?: string;
  amount?: string;
}

interface PostTransactionContextValue {
  isOpen: boolean;
  prefill: TransactionPrefill | null;
  open: () => void;
  openWithPrefill: (prefill: TransactionPrefill) => void;
  close: () => void;
}

const PostTransactionContext = createContext<PostTransactionContextValue | null>(null);

export function usePostTransaction(): PostTransactionContextValue {
  const ctx = useContext(PostTransactionContext);
  if (!ctx) throw new Error("usePostTransaction must be used inside <PostTransactionProvider>");
  return ctx;
}

export function PostTransactionProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefill, setPrefill] = useState<TransactionPrefill | null>(null);

  const open = useCallback(() => {
    setPrefill(null);
    setIsOpen(true);
  }, []);
  const openWithPrefill = useCallback((pf: TransactionPrefill) => {
    setPrefill(pf);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setPrefill(null);
  }, []);

  return (
    <PostTransactionContext.Provider value={{ isOpen, prefill, open, openWithPrefill, close }}>
      {children}
    </PostTransactionContext.Provider>
  );
}
