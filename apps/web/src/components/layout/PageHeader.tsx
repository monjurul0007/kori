import type { ReactNode } from "react";

import { usePageTitle } from "@/lib/usePageTitle";

import { BackLink } from "./BackLink";

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
  /** Parent page; shows a back link above the title and is appended to the tab title. */
  parent?: { label: string; to: string };
}

export function PageHeader({ title, actions, parent }: PageHeaderProps) {
  usePageTitle(parent ? `${title} · ${parent.label}` : title);
  return (
    <>
      {parent && <BackLink to={parent.to}>{parent.label}</BackLink>}
      <header className="mb-4 flex items-center justify-between gap-2">
        <h1 tabIndex={-1} className="text-xl font-semibold focus:outline-none">
          {title}
        </h1>
        {actions}
      </header>
    </>
  );
}
