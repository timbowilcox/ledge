"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PostTransactionContextValue {
  isOpen: boolean;
  open: () => void;
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

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <PostTransactionContext.Provider value={{ isOpen, open, close }}>
      {children}
    </PostTransactionContext.Provider>
  );
}
