import { useSupabaseClient } from "@/integrations/supabase/client";
import { centsToRealAmountNotFormatted } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Plus } from "lucide-react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { useForm } from "react-hook-form";

export type FormValues = {
  ownerId: string;
  name: string;
  amount: number;
  installmentNumber: number;
  purchasedAt: string;
  firstPaymentDate: string;
  currency: string;
};

type Props = {
  isOpen: boolean;
  onOpenChanged: (open: boolean) => void;
  debtId?: string; // When doing update use this prop
  onSubmit: (form: FormValues) => void;
  debtOwners: {
    id: string;
    name: string;
    type: string;
  }[];
};

export const DebtFormModal = ({
  debtId,
  debtOwners,
  onSubmit,
  isOpen,
  onOpenChanged,
}: Props) => {
  const supabase = useSupabaseClient();
  const { data: existingDebt } = useQuery({
    queryKey: ["debt-form", debtId],
    enabled: !!debtId,
    queryFn: async () => {
      if (!debtId) return null;

      const { data, error } = await supabase
        .from("debts")
        .select()
        .eq("id", debtId);

      if (error) {
        throw error;
      }

      const debt = data[0];
      if (!debt) {
        return null;
      }

      return debt;
    },
  });
  const form = useForm<FormValues>();

  useEffect(() => {
    if (existingDebt) {
      form.reset({
        ownerId: existingDebt.debt_owner_id,
        name: existingDebt.name,
        amount: centsToRealAmountNotFormatted(existingDebt.amount),
        installmentNumber: existingDebt.installments,
        firstPaymentDate: existingDebt.first_payment_date,
        purchasedAt: existingDebt.purchased_at,
        currency: existingDebt.currency,
      });
    }
  }, [existingDebt, form]);

  useEffect(() => {
    if (!debtId) {
      form.reset();
    }
  }, [debtId, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChanged}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Debt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Debt</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="debt-owner">Debt Owner</Label>
            <select
              id="debt-owner"
              name="debt_owner_id"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              {...form.register("ownerId", { required: true })}
            >
              <option value="">Select owner...</option>
              {(debtOwners ?? []).map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name} ({owner.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debt-name">Debt Name</Label>
            <Input
              id="debt-name"
              name="name"
              {...form.register("name", { required: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debt-currency">Currency</Label>

            <select
              id="debt-currency"
              name="debt-currency"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              {...form.register("currency", {
                required: true,
              })}
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount per Installment</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                {...form.register("amount", {
                  required: true,
                  min: 0,
                  valueAsNumber: true,
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="installments">Number of Installments</Label>
              <Input
                id="installments"
                name="installments"
                type="number"
                min="1"
                defaultValue="1"
                {...form.register("installmentNumber", {
                  required: true,
                  min: 1,
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Purchased at</Label>
              <Input
                id="start-date"
                name="start_date"
                type="date"
                {...form.register("purchasedAt", {
                  required: true,
                  valueAsDate: true,
                })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="first-payment">First Payment Date</Label>
              <Input
                id="first-payment"
                name="first_payment_date"
                type="date"
                {...form.register("firstPaymentDate", {
                  required: true,
                  valueAsDate: true,
                })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            {debtId ? "Update Debt" : "Add Debt"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
