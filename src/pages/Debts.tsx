import { useState, useMemo } from "react";
import { useSupabaseClient } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { PencilLine, Plus, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "@/hooks/useUser";
import { centsToRealAmount, toCents } from "@/lib/utils";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { SearchBar } from "@/components/feat/SearchBar";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  DebtFormModal,
  FormValues as DebtFormValues,
} from "@/components/feat/DebtFormModal";

export default function Debts() {
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState<string | null>(null);
  const { toast } = useToast();
  const supabaseClient = useSupabaseClient();
  const user = useUserContext();
  const [editDebtId, setEditDebtId] = useState<string | null>(null);
  const { data: debtsData, refetch: refetchDebts } = useQuery({
    queryKey: ["getDebts", user?.id, skip, search],
    initialData: {
      debts: [],
      count: 0,
    },
    queryFn: async () => {
      if (!user) {
        return null;
      }

      let query = supabaseClient
        .from("debts")
        .select(
          `
          id,
          name,
          amount,
          installments,
          first_payment_date,
          purchased_at,
          created_at,
          currency,
          debt_owner:debt_owners!inner (
            id,
            name,
            type
          )
        `,
          {
            count: "exact",
          },
        )
        .eq("workspace_id", user.workspace_id);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .limit(10)
        .range(skip, skip + 10);

      if (error) throw error;

      return {
        debts: data,
        count,
      };
    },
  });
  const { debts, count } = debtsData ?? {};
  const { data: debtOwners, refetch: refetchDebtOwners } = useQuery({
    queryKey: ["getDebtOwners", user?.id],
    queryFn: async () => {
      if (!user) {
        return null;
      }

      const { data, error } = await supabaseClient
        .from("debt_owners")
        .select()
        .eq("workspace_id", user.workspace_id);

      if (error) throw error;

      return data;
    },
  });
  const { data: incomePayersData } = useQuery({
    queryKey: ["getIncomesPayers", user?.id],
    queryFn: async () => {
      if (!user) {
        return null;
      }

      const { data, error } = await supabaseClient
        .from("income_payers")
        .select("*")
        .eq("workspace_id", user.workspace_id);

      if (error) throw error;

      return data;
    },
  });
  const { data: existingCycle } = useQuery({
    queryKey: ["get-current-cycle"],
    queryFn: async () => {
      const currentDate = new Date();
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      const { data, error } = await supabaseClient
        .from("materialized_cycles")
        .select()
        .gte("date", format(startDate, "yyyy-MM-dd"))
        .lte("date", format(endDate, "yyyy-MM-dd"));

      if (error) {
        throw error;
      }

      return data[0];
    },
  });
  const incomePayers = useMemo(() => {
    if (!incomePayersData) return [];

    return incomePayersData;
  }, [incomePayersData]);

  const parsedDebts = useMemo(() => {
    if (!debts) {
      return [];
    }

    return debts.map((debt) => {
      // Calculate end date
      const firstPaymentDate = new Date(debt.first_payment_date);
      let endDate = firstPaymentDate;

      if (debt.installments > 1) {
        // Minus one because the first payment date is already accounts
        endDate = addMonths(firstPaymentDate, debt.installments - 1);
      }

      // Convert amount from cents
      const amount = centsToRealAmount(debt.amount);
      const totalAmount = centsToRealAmount(
        (debt.installments ?? 1) * debt.amount,
      );

      return {
        ...debt,
        endDate,
        amount,
        totalAmount,
      };
    });
  }, [debts]);
  const paginationState = useMemo(() => {
    const canGoPrev = skip > 0;
    const canGoNext = skip + 10 <= count;

    return {
      canGoPrev,
      canGoNext,
    };
  }, [count, skip]);

  const addDebtOwner = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!user) {
      return;
    }

    const formData = new FormData(e.currentTarget);

    const { error } = await supabaseClient.from("debt_owners").insert({
      workspace_id: user.workspace_id,
      name: formData.get("name") as string,
      type: formData.get("type") as string,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({ title: "Success", description: "Debt owner added" });
      setOwnerDialogOpen(false);
      refetchDebtOwners();
    }
  };

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);

  async function addOrUpdateDebt({
    form,
    addMore,
    onSubmitFinish,
  }: {
    form: DebtFormValues;
    addMore: boolean;
    onSubmitFinish: () => void;
  }) {
    try {
      if (editDebtId) {
        await updateDebt(form);
      } else {
        await addDebt(form, addMore);
      }
    } finally {
      onSubmitFinish();
    }
  }

  const addDebt = async (values: DebtFormValues, addMore: boolean) => {
    if (!user) {
      return;
    }

    const amountToCents = toCents(values.amount);
    let reimbursementId: string | null = null;
    // Handle debt with reimbursement
    if (values.payerId) {
      const amountReimbursed = toCents(
        values.amountReimbursed ?? amountToCents,
      );
      const { error: reimbursementCreationError, data: reimbursementData } =
        await supabaseClient
          .from("incomes")
          .insert({
            name: `Reimbursement for ${values.name}`,
            amount: amountReimbursed,
            is_recurrent: !values.hasEnd,
            currency: values.currency,
            workspace_id: user.workspace_id,
            first_income_date: values.firstPaymentDate,
            payer_id: values.payerId,
            type: "REIMBURSEMENT",
            ...(values.hasEnd && {
              number_of_payments: values.installmentNumber,
            }),
          })
          .select("id");
      if (reimbursementCreationError) {
        toast({
          variant: "destructive",
          title: "Error",
          description: reimbursementCreationError.message,
        });
        return;
      }

      reimbursementId = reimbursementData[0].id;
    }
    const { error, data: createdDebt } = await supabaseClient
      .from("debts")
      .insert({
        workspace_id: user.workspace_id,
        debt_owner_id: values.ownerId,
        name: values.name,
        amount: amountToCents,
        has_end: values.hasEnd,
        purchased_at: values.purchasedAt,
        first_payment_date: values.firstPaymentDate,
        currency: values.currency,
        reimbursement_income_id: reimbursementId,
        type: values.type,
        ...(values.hasEnd && {
          installments: values.installmentNumber,
        }),
      })
      .select("id");

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return;
    }

    if (values.syncWithExistingCycle && existingCycle) {
      const amount =
        values.type === "VARIABLE" && values.syncExistingCycleAmout
          ? values.syncExistingCycleAmout
          : values.amount;
      await supabaseClient.from("materialized_debts").insert({
        cycle_id: existingCycle.id,
        debt_id: createdDebt[0].id,
        amount: toCents(amount),
      });
    }

    toast({ title: "Success", description: "Debt added successfully" });
    refetchDebts();

    if (!addMore) {
      setIsDebtModalOpen(false);
    }
  };

  async function updateDebt(values: DebtFormValues) {
    if (!user) {
      return;
    }

    const {
      data: existingReimbursementData,
      error: existingReimbursementError,
    } = await supabaseClient
      .from("debts")
      .select(
        `
        reimbursement_income:incomes!inner (
          id
        )
      `,
      )
      .eq("id", editDebtId);

    if (existingReimbursementError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: existingReimbursementError.message,
      });
      return;
    }

    const existingReimbursement = existingReimbursementData[0];
    let reimbursementId: string | null = null;
    const amountToCents = toCents(values.amount);
    const amountReimbursed = toCents(values.amountReimbursed ?? values.amount);

    if (existingReimbursement && values.payerId) {
      // Update reimbursement
      const { error } = await supabaseClient
        .from("incomes")
        .update({
          name: `Reimbursement for ${values.name}`,
          amount: amountReimbursed,
          is_recurrent: !values.hasEnd,
          currency: values.currency,
          workspace_id: user.workspace_id,
          first_income_date: values.firstPaymentDate,
          payer_id: values.payerId,
          type: "REIMBURSEMENT",
          ...(values.hasEnd && {
            number_of_payments: values.installmentNumber,
          }),
        })
        .eq("id", existingReimbursement.reimbursement_income.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        return;
      }
      reimbursementId = existingReimbursement.reimbursement_income.id;
    } else if (!existingReimbursement && values.payerId) {
      // Create reimbursement
      const { error: reimbursementCreationError, data: reimbursementData } =
        await supabaseClient
          .from("incomes")
          .insert({
            name: `Reimbursement for ${values.name}`,
            amount: amountReimbursed,
            is_recurrent: !values.hasEnd,
            currency: values.currency,
            workspace_id: user.workspace_id,
            first_income_date: values.firstPaymentDate,
            payer_id: values.payerId,
            type: "REIMBURSEMENT",
            ...(values.hasEnd && {
              number_of_payments: values.installmentNumber,
            }),
          })
          .select("id");
      if (reimbursementCreationError) {
        toast({
          variant: "destructive",
          title: "Error",
          description: reimbursementCreationError.message,
        });
        return;
      }

      reimbursementId = reimbursementData[0].id;
    } else if (existingReimbursement && !values.payerId) {
      // Delete reimbursement
      const { error } = await supabaseClient
        .from("incomes")
        .delete()
        .eq("id", existingReimbursement.reimbursement_income.id);
      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message,
        });
        return;
      }
    }

    const { error } = await supabaseClient
      .from("debts")
      .update({
        workspace_id: user.workspace_id,
        debt_owner_id: values.ownerId,
        name: values.name,
        amount: amountToCents,
        purchased_at: values.purchasedAt,
        first_payment_date: values.firstPaymentDate,
        currency: values.currency,
        reimbursement_income_id: reimbursementId,
        has_end: values.hasEnd,
        type: values.type,
        ...(values.hasEnd && {
          installments: values.installmentNumber,
        }),
      })
      .eq("id", editDebtId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      return;
    }

    if (values.syncWithExistingCycle && existingCycle) {
      const amount =
        values.type === "VARIABLE" && values.syncExistingCycleAmout
          ? values.syncExistingCycleAmout
          : values.amount;
      await supabaseClient.from("materialized_debts").upsert(
        {
          cycle_id: existingCycle.id,
          debt_id: editDebtId,
          amount: toCents(amount),
        },
        { onConflict: "debt_id, cycle_id", ignoreDuplicates: false },
      );
    }

    toast({ title: "Success", description: "Debt added successfully" });
    refetchDebts();

    setEditDebtId(null);
    setIsDebtModalOpen(false);
  }

  const deleteDebt = async (id: string) => {
    const confirmed = window.confirm("Delete debt?");
    if (!confirmed) return;

    const { error } = await supabaseClient.from("debts").delete().eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({ title: "Success", description: "Debt deleted" });
      refetchDebts();
    }
  };

  function goPrevPage() {
    if (skip <= 0) {
      return;
    }

    setSkip(skip - 10);
  }

  function goNextPage() {
    const nextSkip = skip + 10;
    if (nextSkip > count) {
      return;
    }
    setSkip(nextSkip);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Debt Management</h1>
          <p className="text-muted-foreground">
            Manage your debts and installments
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={ownerDialogOpen} onOpenChange={setOwnerDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Debt Owner</DialogTitle>
              </DialogHeader>
              <form onSubmit={addDebtOwner} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-name">Name</Label>
                  <Input id="owner-name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    name="type"
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    required
                  >
                    <option value="institution">Institution</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="person">Person</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  Add Owner
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <DebtFormModal
            debtId={editDebtId}
            debtOwners={debtOwners}
            onSubmit={addOrUpdateDebt}
            isOpen={isDebtModalOpen}
            onOpenChanged={(isOpen) => {
              setIsDebtModalOpen(isOpen);
              if (!isOpen) {
                setEditDebtId(null);
              }
            }}
            incomePayers={incomePayers}
            showSyncCycleSwitch={!!existingCycle}
          />
        </div>
      </div>
      <SearchBar onSearch={setSearch} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Installment amount</TableHead>
            <TableHead>Installments #</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Purchaset at</TableHead>
            <TableHead>First payment dt.</TableHead>
            <TableHead>End date</TableHead>
            <TableHead className="text-center">🎛️</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parsedDebts.map((debt) => (
            <TableRow key={debt.id}>
              <TableCell>{debt.name}</TableCell>
              <TableCell>{debt.debt_owner.name}</TableCell>
              <TableCell>
                {debt.amount} {debt.currency}
              </TableCell>
              <TableCell>{debt.installments ?? "N/A"}</TableCell>
              <TableCell>
                {debt.totalAmount} {debt.currency}
              </TableCell>
              <TableCell>
                {format(new Date(debt.purchased_at), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>
                {format(new Date(debt.first_payment_date), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>
                {format(new Date(debt.endDate), "MMM dd, yyyy")}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="link"
                  className="p-0"
                  onClick={() => {
                    setEditDebtId(debt.id);
                    setIsDebtModalOpen(true);
                  }}
                >
                  <PencilLine size={18} />
                </Button>
                <Button variant="link" onClick={() => deleteDebt(debt.id)}>
                  <Trash2 color="red" size={18} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {parsedDebts.length > 0 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={goPrevPage}
                className={`${paginationState.canGoPrev ? "" : "pointer-events-none opacity-40"}`}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={goNextPage}
                className={`${paginationState.canGoNext ? "" : "pointer-events-none opacity-40"}`}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {(debts ?? []).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No debts yet. Add your first debt to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
