'use client';
import { useEffect, type MutableRefObject } from 'react';

export function useRefSync<T>(ref: MutableRefObject<T>, value: T): void {
  useEffect(() => {
    ref.current = value;
  }, [ref, value]);
}
