import { Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useSupabaseClient } from "@/integrations/supabase/client";
import { useUserContext } from "@/hooks/useUser";
import { useEffect } from "react";
import { centsToRealAmountNotFormatted } from "@/lib/utils";

export type FormValues = {
  payerId: string;
  name: string;
  amount: number;
  currency: string;
  isRecurrent: boolean;
  numberOfPayments: number;
  firstIncomeDate: string;
};

type Props = {
  isOpen: boolean;
  onOpenChanged: (open: boolean) => void;
  incomeId?: string; // When doing update use this prop
  onSubmit: (form: FormValues) => void;
  incomePayers: {
    id: string;
    name: string;
    type: string;
  }[];
};

export function IncomeFormModal(props: Props) {
  const supabase = useSupabaseClient();
  const { data: existingIncome } = useQuery({
    queryKey: ["existing-income", props.incomeId],
    enabled: !!props.incomeId,
    queryFn: async () => {
      if (!props.incomeId) {
        return;
      }

      const { data, error } = await supabase
        .from("incomes")
        .select()
        .eq("id", props.incomeId)
        .single();

      if (error) throw error;

      return data;
    },
  });
  const form = useForm<FormValues>({
    defaultValues: {
      isRecurrent: false,
    },
  });
  const isRecurrent = form.getValues("isRecurrent");

  useEffect(() => {
    if (existingIncome) {
      form.reset({
        payerId: existingIncome.payer_id,
        name: existingIncome.name,
        amount: centsToRealAmountNotFormatted(existingIncome.amount),
        currency: existingIncome.currency,
        numberOfPayments: existingIncome.number_of_payments,
        isRecurrent: existingIncome.is_recurrent,
        firstIncomeDate: existingIncome.first_income_date,
      });
    }
  }, [existingIncome, form]);

  useEffect(() => {
    if (!props.incomeId) {
      form.reset();
    }
  }, [props.incomeId, form]);

  return (
    <Dialog open={props.isOpen} onOpenChange={props.onOpenChanged}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Income
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Income</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(props.onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="income-payer">Income Payer</Label>
            <select
              id="income-payer"
              name="income_payer_id"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              {...form.register("payerId", {
                required: true,
              })}
            >
              <option value="">Select payer...</option>
              {props.incomePayers.map((payer) => (
                <option key={payer.id} value={payer.id}>
                  {payer.name} ({payer.type})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="income-name">Income Name</Label>
            <Input
              id="income-name"
              name="name"
              {...form.register("name", { required: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="income-amount">Amount</Label>
              <Input
                id="income-amount"
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
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                name="currency"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                {...form.register("currency", {
                  required: true,
                })}
              >
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="is-recurrent"
              checked={isRecurrent}
              onCheckedChange={(checked) =>
                form.setValue("isRecurrent", checked)
              }
            />
            <Label htmlFor="is-recurrent" className="cursor-pointer">
              Is Recurrent
            </Label>
          </div>
          {!isRecurrent && (
            <div className="space-y-2">
              <Label htmlFor="number-of-payments">Number of Payments</Label>
              <Input
                id="number-of-payments"
                name="number_of_payments"
                type="number"
                min="1"
                defaultValue="1"
                {...form.register("numberOfPayments", {
                  required: true,
                  valueAsNumber: true,
                })}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="first-income-date">First Income Date</Label>
            <Input
              id="first-income-date"
              name="first_income_date"
              type="date"
              {...form.register("firstIncomeDate", {
                required: true,
                valueAsDate: true,
              })}
            />
          </div>
          <Button type="submit" className="w-full">
            {props.incomeId ? "Update Income" : "Add Income"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
