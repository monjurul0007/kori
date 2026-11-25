import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props<T> {
  title: string;
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  className?: string;
  /** Keep the heading for screen readers only, when the card's content says it all. */
  hideTitle?: boolean;
}

/** A dashboard card with its own skeleton and retry, so one failing report doesn't blank the page. */
export function QueryCard<T>({ title, query, children, className, hideTitle }: Props<T>) {
  return (
    <Card className={className}>
      {hideTitle ? (
        <CardTitle className="sr-only">{title}</CardTitle>
      ) : (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(hideTitle && "pt-5 md:pt-6")}>
        {query.isPending && <Skeleton aria-label={`Loading ${title}`} className="h-24 w-full" />}
        {query.isError && (
          <div role="alert" className="text-sm">
            <p>
              {query.error instanceof ApiError ? query.error.message : `Couldn't load ${title}.`}
            </p>
            <Button className="mt-2" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {query.isSuccess && children(query.data)}
      </CardContent>
    </Card>
  );
}
