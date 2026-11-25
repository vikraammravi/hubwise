"use client";
import { createContext, useContext, useEffect } from "react";

/**
 * True when the signed-in shell already shows the section name in its header bar, so page headings
 * stay available to screen readers but are not repeated on the page.
 */
export const ShellHeadingContext = createContext(false);
export function useShellShowsHeading() { return useContext(ShellHeadingContext); }

/** Lets a page name itself in the header bar (e.g. the branch name on branch Home). */
export const HeaderTitleContext = createContext<(title: string | null) => void>(() => {});
export function useHeaderTitle(title: string | null | undefined) {
  const setTitle = useContext(HeaderTitleContext);
  useEffect(() => {
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [setTitle, title]);
}
