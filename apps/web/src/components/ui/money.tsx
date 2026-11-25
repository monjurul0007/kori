import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { formatTaka, toPoisha } from "@/lib/money";
import { cn } from "@/lib/utils";

const moneyVariants = cva("font-display tabular-nums", {
  variants: {
    variant: { default: "", income: "text-income", over: "text-over" },
  },
  defaultVariants: { variant: "default" },
});

interface Props
  extends Omit<React.ComponentProps<"span">, "children">, VariantProps<typeof moneyVariants> {
  /** A decimal string in taka ("1250.50"), never a float. */
  amount: string;
  /** Show "+" before a positive amount, for income. */
  sign?: boolean;
}

export function Money({ amount, sign = false, variant, className, ...props }: Props) {
  const text = formatTaka(amount);
  const isPositive = toPoisha(amount) > 0n;
  return (
    <span className={cn(moneyVariants({ variant }), className)} {...props}>
      {sign && isPositive ? "+" : ""}
      {text}
    </span>
  );
}
