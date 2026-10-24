// Supplier-workspace dark scope. Each seller page calls useSupplierTheme();
// while any of them is mounted, document.body carries the `fw-dark` class, so
// the whole app (shell included) renders the Confluence Dark palette. Leaving
// the Supplier workspace unmounts the last page and main's light river
// redesign returns untouched — Buyer and Ecosystem never see the dark tokens.
import { useLayoutEffect } from 'react';
import './theme.css';

let mounted = 0;

/** Declare this component's subtree as part of the dark supplier workspace. */
export function useSupplierTheme(): void {
  useLayoutEffect(() => {
    mounted += 1;
    document.body.classList.add('fw-dark');
    return () => {
      mounted -= 1;
      if (mounted <= 0) {
        mounted = 0;
        document.body.classList.remove('fw-dark');
      }
    };
  }, []);
}
