import { z } from "zod";

import { validateAmount } from "./money";

/** A typed taka amount ("৳ 1,250.5", "১২৫০"); the message is `validateAmount`'s, so every form agrees. */
export const moneyAmount = z.string().superRefine((value, ctx) => {
  const message = validateAmount(value);
  if (message) ctx.addIssue({ code: "custom", message });
});
