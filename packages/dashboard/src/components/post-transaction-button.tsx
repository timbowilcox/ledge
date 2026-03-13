"use client";

import { usePostTransaction } from "./post-transaction-provider";
import type { ReactNode, CSSProperties } from "react";

interface PostTransactionButtonProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function PostTransactionButton({ children, className, style }: PostTransactionButtonProps) {
  const { open } = usePostTransaction();

  return (
    <button onClick={open} className={className} style={style}>
      {children}
    </button>
  );
}
