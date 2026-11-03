import { PageHeader } from "@/components/layout/PageHeader";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import {
  useArchivePaymentMethod,
  useManagedPaymentMethods,
  useReorderPaymentMethods,
  useSavePaymentMethod,
  type PaymentMethod,
} from "./hooks";
import { nextSortOrder } from "./reorder";
import { ReferenceListEditor } from "./ReferenceListEditor";

type Kind = PaymentMethod["kind"];
type Extra = { kind: Kind };

const KIND_LABELS: Record<Kind, string> = {
  cash: "Cash",
  mobile_wallet: "Mobile wallet",
  card: "Card",
  bank: "Bank",
  other: "Other",
};

export function PaymentMethodsSettingsPage() {
  const methods = useManagedPaymentMethods();
  const save = useSavePaymentMethod();
  const archive = useArchivePaymentMethod();
  const reorder = useReorderPaymentMethods();

  return (
    <>
      <PageHeader title="Payment methods" />
      {methods.isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : methods.isError ? (
        <p role="alert">Couldn’t load payment methods.</p>
      ) : (
        <ReferenceListEditor<PaymentMethod, Extra>
          noun="payment method"
          items={methods.data}
          detail={(m) => KIND_LABELS[m.kind]}
          initialExtra={(m) => ({ kind: m?.kind ?? "cash" })}
          extraFields={(value, set) => (
            <div className="space-y-1">
              <Label htmlFor="pm-kind">Kind</Label>
              <select
                id="pm-kind"
                value={value.kind}
                onChange={(e) => set({ kind: e.target.value as Kind })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
              >
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
          onSave={({ item, name, extra }) =>
            save.mutateAsync({
              id: item?.id,
              sort_order: item?.sort_order ?? nextSortOrder(methods.data),
              name,
              ...extra,
            })
          }
          onMove={(patches) => patches.length && reorder.mutate(patches)}
          onArchive={(item, archived) => archive.mutateAsync({ id: item.id, archive: archived })}
        />
      )}
    </>
  );
}
