import { useEffect } from "react";

export const APP_NAME = "Kori";

/** Sets the browser tab title to `<title> · Kori`, so tabs, history and screen readers can tell pages apart. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);
}
