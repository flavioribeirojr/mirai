import { useState, useMemo } from "react";
import { useSupabaseClient } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Plus,
  Trash2Icon,
} from "lucide-react";
import {
  differenceInCalendarMonths,
  endOfMonth,
  format,
  formatDate,
  isAfter,
  startOfMonth,
} from "date-fns";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useUserContext } from "@/hooks/useUser";
import { useSession } from "@/hooks/useSession";
import {
  centsToRealAmount,
  centsToRealAmountNotFormatted,
  toCents,
} from "@/lib/utils";
import { useSupabaseFunction } from "@/hooks/useSupabaseFunction";
import { Spinner } from "@/components/ui/spinner";
import { CycleStatusToggler } from "@/components/feat/CycleStatusToggler";
import { Database } from "@/integrations/supabase/database.types";

type DashboardIncome = {
  id: string;
  currency: string;
  amount: number; // In cents
  name: string;
  status: string;
  type: Database["public"]["Enums"]["IncomeType"];
  payer: {
    id: string;
    name: string;
  };
};

type DashboardDebt = {
  id: string;
  name: string;
  amount: number; // In cents
  installments: number;
  installment_number?: number;
  status: string;
  type: Database["public"]["Enums"]["DebtType"];
  owner: {
    id: string;
    name: string;
  };
};

type DashboardIncomeGroupedByPayer = {
  id: string;
  name: string;
  status: "PENDING" | "PAID";
  incomes: DashboardIncome[];
  total: number;
};

type DashboardDebtGroupedByOwner = {
  id: string;
  name: string;
  status: "PENDING" | "PAID";
  debts: DashboardDebt[];
  total: number;
};

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(startOfMonth(new Date()));
  const dateRange = useMemo(() => {
    return {
      startDate: startOfMonth(currentDate),
      endDate: endOfMonth(currentDate),
    };
  }, [currentDate]);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [startCycleOpen, setStartCycleOpen] = useState(false);
  const supabase = useSupabaseClient();
  const user = useUserContext();
  const calculateUSDToBRLFunction = useSupabaseFunction({
    functionName: "calculate-usd-to-brl",
  });
  const { data: cycleData, refetch: refetchCycleData } = useQuery({
    queryKey: ["get-dashboard-finance-data", dateRange, user],
    queryFn: async function loadCurrentDateFinance() {
      const presentDateStartOfMonth = startOfMonth(new Date());

      const isCycleInTheFuture = isAfter(
        dateRange.startDate,
        presentDateStartOfMonth,
      );

      // For cycle in the future we don't load materialized finance, instead calculate based on existing debts and incomes
      if (isCycleInTheFuture) {
        return loadDashboardDataFromNonMaterializedFinance();
      }

      return loadDashboardDataFromMaterializedFinance();
    },
  });
  const kyckstartCycleFunction = useSupabaseFunction({
    functionName: "kickstart-cycle",
  });
  const startCycleMutation = useMutation({
    mutationFn: async ({
      date,
      incomesOverride,
      debtsOverride,
    }: {
      date: string;
      incomesOverride?: {
        incomeId: string;
        amount: number;
      }[];
      debtsOverride?: {
        debtId: string;
        amount: number;
      }[];
    }) => {
      await kyckstartCycleFunction.invoke({
        date,
        incomesOverride,
        debtsOverride,
      });
    },
  });
  const addExpenseMutation = useMutation({
    mutationFn: async ({
      cycleId,
      name,
      amountInCents,
      date,
      note,
      category,
    }: {
      cycleId: string;
      name: string;
      amountInCents: number;
      date: Date;
      note?: string;
      category?: string;
    }) => {
      await supabase.from("cycle_expenses").insert({
        cycle_id: cycleId,
        name,
        amount: amountInCents,
        date: date.toISOString(),
        note,
        category_name: category,
      });
    },
  });
  const { toast } = useToast();
  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const confirmed = window.confirm("Are you sure?");
      if (!confirmed) {
        return;
      }

      try {
        await supabase.from("cycle_expenses").delete().eq("id", id);
        toast({
          title: "Expense successfully deleted",
        });
        refetchCycleData();
      } catch (err) {
        console.error(err);
        toast({
          title: "Failed to delete expense",
          variant: "destructive",
        });
      }
    },
  });

  async function loadDashboardDataFromMaterializedFinance() {
    const startDate = dateRange.startDate.toISOString();
    const endDate = dateRange.endDate.toISOString();

    const { data: cycleData, error: cycleLoadError } = await supabase
      .from("materialized_cycles")
      .select(
        `
        *,
        expenses:cycle_expenses!left (
          id,
          name,
          date,
          category_name,
          amount,
          note
        ),
        materialized_debts:materialized_debts!inner (
          id,
          amount,
          status,
          original_debt:debts!inner (
            id,
            name,
            amount,
            installments,
            first_payment_date,
            end_date,
            has_end,
            type,
            owner:debt_owners!inner (
              id,
              name,
              type
            )
          )
        ),
        materialized_incomes:materialized_incomes!inner (
          id,
          amount,
          status,
          original_income:incomes!inner (
            id,
            name,
            amount,
            currency,
            type,
            payer:income_payers!inner (
              id,
              name,
              type
            )
          )
        )
      `,
      )
      .eq("workspace_id", user.workspace_id)
      .gte("date", format(startDate, "yyyy-MM-dd"))
      .lte("date", format(endDate, "yyyy-MM-dd"));

    if (cycleLoadError) {
      throw cycleLoadError;
    }

    const cycle = cycleData[0];
    if (!cycle) {
      const nonMaterializedCycle =
        await loadDashboardDataFromNonMaterializedFinance();

      return {
        cycleId: `not-started-${new Date().toISOString()}`,
        date: dateRange.startDate,
        debts: nonMaterializedCycle.debts,
        incomes: nonMaterializedCycle.incomes,
        expenses: [],
        type: "materialized-not-started",
        totalDebts: nonMaterializedCycle.totalDebts,
        totalIncomes: nonMaterializedCycle.totalIncomes,
        totalExpenses: 0,
        availableMoney: nonMaterializedCycle.availableMoney,
      };
    }

    // Force correct date, if date is 2025-12-01 this could become be 2025-11-30
    const cycleDate = new Date(`${cycle.date} 08:00`);
    const mappedDebts = cycle.materialized_debts.map<DashboardDebt>(
      (matDebt) => {
        const firstPaymentDate = new Date(
          matDebt.original_debt.first_payment_date,
        );
        const installmentNumber =
          differenceInCalendarMonths(cycleDate, firstPaymentDate) + 1;
        return {
          id: matDebt.id,
          name: matDebt.original_debt.name,
          amount: matDebt.amount,
          status: matDebt.status,
          installments: matDebt.original_debt.installments,
          installment_number: installmentNumber,
          hasEnd: matDebt.original_debt.has_end,
          type: matDebt.original_debt.type,
          owner: {
            id: matDebt.original_debt.owner.id,
            name: matDebt.original_debt.owner.name,
          },
        };
      },
    );
    const mappedIncomes = cycle.materialized_incomes.map<DashboardIncome>(
      (matIncome) => ({
        id: matIncome.id,
        name: matIncome.original_income.name,
        amount: matIncome.amount,
        currency: "BRL",
        status: matIncome.status,
        type: matIncome.original_income.type,
        payer: {
          id: matIncome.original_income.payer.id,
          name: matIncome.original_income.payer.name,
        },
      }),
    );
    const totalDebts = mappedDebts.reduce((acc, debt) => acc + debt.amount, 0);
    const totalIncomes = mappedIncomes.reduce(
      (acc, income) => acc + income.amount,
      0,
    );
    const totalExpenses = cycle.expenses.reduce(
      (acc, expense) => acc + expense.amount,
      0,
    );
    const availableMoney = totalIncomes - totalDebts - totalExpenses;

    return {
      cycleId: cycle.id,
      date: new Date(cycle.date),
      debts: mappedDebts,
      incomes: mappedIncomes,
      expenses: cycle.expenses,
      type: "materialized",
      totalDebts: totalDebts,
      totalIncomes: totalIncomes,
      totalExpenses: totalExpenses,
      availableMoney: availableMoney,
    };
  }

  async function loadDashboardDataFromNonMaterializedFinance() {
    const startDate = dateRange.startDate.toISOString();
    const endDate = dateRange.endDate.toISOString();
    // Load debts
    const { data: debts, error: debtsError } = await supabase
      .from("debts")
      .select(
        `
        *,
        debt_owner:debt_owners!inner (
          id,
          name,
          type
        )
      `,
      )
      .eq("workspace_id", user.workspace_id)
      .or(
        [
          `and(first_payment_date.gte.${startDate},first_payment_date.lte.${endDate})`,
          `and(first_payment_date.lte.${startDate},end_date.gte.${endDate})`,
          `and(first_payment_date.lte.${startDate},end_date.gte.${startDate},end_date.lte.${endDate})`,
          `and(has_end.eq.false,first_payment_date.lte.${startDate})`,
        ].join(","),
      );

    if (debtsError) {
      throw debtsError;
    }

    // Load incomes
    const { data: incomes, error: incomesError } = await supabase
      .from("incomes")
      .select(
        `
        *,
        payer:income_payers!inner (
          id,
          name,
          type
        )
      `,
      )
      .eq("workspace_id", user.workspace_id!)
      .or(
        [
          `and(first_income_date.gte.${startDate},first_income_date.lte.${endDate})`,
          `and(first_income_date.lte.${startDate},end_date.gte.${endDate})`,
          `and(first_income_date.lte.${startDate},end_date.gte.${startDate},end_date.lte.${endDate})`,
          `and(is_recurrent.eq.true,first_income_date.lte.${startDate})`,
        ].join(","),
      );

    if (incomesError) {
      throw incomesError;
    }

    const cycleDate = new Date(startDate);
    const debtsWithBRLAmount = await Promise.all(
      debts.map(async (debt) => {
        if (debt.currency !== "USD") return debt;

        const data = await calculateUSDToBRLFunction.invoke({
          amountInUSDCents: debt.amount,
        });

        const amountInBRLCents = data.amountInBRLCents as number;
        return {
          ...debt,
          amount: amountInBRLCents,
        };
      }),
    );
    const mappedDebts: Array<DashboardDebt> =
      debtsWithBRLAmount.map<DashboardDebt>((debt) => {
        const firstPaymentDate = new Date(debt.first_payment_date);
        const installmentNumber =
          differenceInCalendarMonths(cycleDate, firstPaymentDate) + 1;
        return {
          id: debt.id,
          name: debt.name,
          amount: debt.amount,
          status: "PENDING",
          installment_number: installmentNumber,
          installments: debt.installments,
          hasEnd: debt.has_end,
          type: debt.type,
          owner: {
            id: debt.debt_owner_id,
            name: debt.debt_owner.name,
          },
        };
      });

    const incomesWithBRLAmount = await Promise.all(
      incomes.map(async (income) => {
        if (income.currency !== "USD") return income;

        const data = await calculateUSDToBRLFunction.invoke({
          amountInUSDCents: income.amount,
        });

        const amountInBRLCents = data.amountInBRLCents as number;
        return {
          ...income,
          amount: amountInBRLCents,
        };
      }),
    );

    const mappedIncomes = incomesWithBRLAmount.map<DashboardIncome>(
      (income) => ({
        id: income.id,
        name: income.name,
        amount: income.amount,
        currency: income.currency,
        type: income.type,
        status: "PENDING",
        payer: {
          id: income.payer.id,
          name: income.payer.name,
        },
      }),
    );

    const totalDebts = mappedDebts.reduce((acc, debt) => acc + debt.amount, 0); // In cents
    const totalIncomes = mappedIncomes.reduce(
      (acc, income) => acc + income.amount,
      0,
    ); // In cents
    const availableMoney = totalIncomes - totalDebts;

    return {
      cycleId: `future-cycle-${new Date().toISOString()}`,
      date: cycleDate,
      debts: mappedDebts,
      incomes: mappedIncomes,
      expenses: [],
      type: "forecast",
      totalDebts: totalDebts,
      totalIncomes: totalIncomes,
      totalExpenses: 0,
      availableMoney: availableMoney,
    };
  }

  const toggleDebtOwnerStatus = async (
    debtOwnerId: string,
    newStatus: string,
  ) => {
    if (cycleData.type === "forecast") {
      return; // Can't change status for non materialized debt
    }
    const { data, error } = await supabase
      .from("materialized_debts")
      .select("id, debt:debts!inner(*)")
      .eq("cycle_id", cycleData.cycleId)
      .eq("debt.debt_owner_id", debtOwnerId);

    if (error) {
      throw error;
    }

    await supabase
      .from("materialized_debts")
      .update({ status: newStatus })
      .in(
        "id",
        data.map((item) => item.id),
      );

    refetchCycleData();
  };

  const toggleIncomePayerStatus = async (
    incomePayerId: string,
    newStatus: string,
  ) => {
    if (cycleData.type === "forecast") {
      return; // Can't change status for non materialized debt
    }
    const { data, error } = await supabase
      .from("materialized_incomes")
      .select("id,income:incomes!inner(*)")
      .eq("cycle_id", cycleData.cycleId)
      .eq("income.payer_id", incomePayerId);

    if (error) {
      throw error;
    }

    await supabase
      .from("materialized_incomes")
      .update({ status: newStatus })
      .in(
        "id",
        data.map((item) => item.id),
      );

    refetchCycleData();
  };

  const addExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await addExpenseMutation.mutateAsync({
        cycleId: cycleData.cycleId,
        name: formData.get("name") as string,
        amountInCents: toCents(parseFloat(formData.get("amount") as string)),
        date: new Date(formData.get("date") as string),
        note: formData.get("note") as string,
        category: formData.get("category") as string,
      });
      toast({
        title: "Expense added to your cycle",
      });
      refetchCycleData();
      setExpenseDialogOpen(false);
    } catch (err) {
      console.log(err);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
      });
    }
  };

  async function handleStartCycleSubmit(form: FormData) {
    const incomesOverride: {
      incomeId: string;
      amount: number;
    }[] = [];
    const debtsOverride: {
      debtId: string;
      amount: number;
    }[] = [];
    for (const [name, value] of form.entries()) {
      const [prefix, ...idParts] = name.split("-");
      const id = idParts.join("-");
      const amountAsNumber = Number(value);
      const amount = toCents(amountAsNumber);

      if (prefix === "income") {
        incomesOverride.push({
          incomeId: id,
          amount,
        });
      } else {
        debtsOverride.push({
          debtId: id,
          amount,
        });
      }
    }

    try {
      await startCycleMutation.mutateAsync({
        date: formatDate(cycleData.date, "yyyy-MM-dd"),
        incomesOverride,
        debtsOverride,
      });

      toast({
        title: "Cycle successfully started",
        description: "You may now add expenses",
      });
      setStartCycleOpen(false);
      refetchCycleData();
    } catch (err) {
      console.log(err);
      toast({
        title: "Failed to start cycle",
        description: "Try again later.",
      });
    }
  }

  const goToPreviousMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(startOfMonth(newDate));
  };

  const goToNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(startOfMonth(newDate));
  };

  // Group debts by owner
  const debtsByOwner = useMemo(() => {
    const grouped = (cycleData?.debts || []).reduce<{
      [key: string]: DashboardDebtGroupedByOwner;
    }>((acc, debt) => {
      const ownerId = debt.owner.id;
      if (!acc[ownerId]) {
        acc[ownerId] = {
          id: debt.id,
          name: debt.owner.name,
          debts: [],
          total: 0,
          status: "PENDING",
        };
      }
      acc[ownerId].debts.push(debt);
      acc[ownerId].total += debt.amount;
      const allDebtsArePaid = acc[ownerId].debts.every(
        (debt) => debt.status === "PAID",
      );
      acc[ownerId].status = allDebtsArePaid ? "PAID" : "PENDING";
      return acc;
    }, {});

    return grouped;
  }, [cycleData]);

  // Group incomes by payer
  const incomesByOwner = useMemo(() => {
    const grouped = (cycleData?.incomes || []).reduce<{
      [key: string]: DashboardIncomeGroupedByPayer;
    }>((acc, income) => {
      const payerId = income.payer.id;
      if (!acc[payerId]) {
        acc[payerId] = {
          id: income.id,
          name: income.payer.name,
          incomes: [],
          total: 0,
          status: "PENDING",
        };
      }
      acc[payerId].incomes.push(income);
      acc[payerId].total += income.amount;

      const allIncomesArePaid = acc[payerId].incomes.every(
        (income) => income.status === "PAID",
      );
      acc[payerId].status = allIncomesArePaid ? "PAID" : "PENDING";
      return acc;
    }, {});

    return grouped;
  }, [cycleData]);

  async function toggleDebtStatus(matDebtId: string, newStatus: string) {
    if (cycleData.type === "forecast") {
      return; // Can't change status for non materialized debt
    }

    await supabase
      .from("materialized_debts")
      .update({ status: newStatus })
      .eq("id", matDebtId);

    refetchCycleData();
  }

  async function toggleIncomeStatus(matIncomeId: string, newStatus: string) {
    if (cycleData.type === "forecast") {
      return; // Can't change status for non materialized debt
    }

    await supabase
      .from("materialized_incomes")
      .update({ status: newStatus })
      .eq("id", matIncomeId);

    refetchCycleData();
  }

  const paymentIncomes = useMemo(() => {
    if (!cycleData) {
      return [];
    }

    return cycleData.incomes.filter((income) => income.type === "PAYMENT");
  }, [cycleData]);

  const variableDebts = useMemo(() => {
    if (!cycleData) {
      return [];
    }

    return cycleData.debts.filter((debt) => debt.type === "VARIABLE");
  }, [cycleData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-muted-foreground">
            Track your income, debts, and expenses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="px-4 py-2 bg-card rounded-lg border font-semibold min-w-[180px] text-center">
            {format(currentDate, "MMMM yyyy")}
          </div>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-success" />
              <div className="text-2xl font-bold text-success">
                ${centsToRealAmount(cycleData?.totalIncomes ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Debts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-danger" />
              <div className="text-2xl font-bold text-danger">
                ${centsToRealAmount(cycleData?.totalDebts ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-warning" />
              <div className="text-2xl font-bold text-warning">
                ${centsToRealAmount(cycleData?.totalExpenses ?? 0)}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={
            (cycleData?.availableMoney ?? 0) >= 0
              ? "bg-success-light"
              : "bg-danger-light"
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${centsToRealAmount(cycleData?.availableMoney ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Start cycle */}
      {cycleData?.type === "materialized-not-started" && (
        <Card>
          <CardContent className="p-8 flex items-center justify-center flex-col">
            <p className="text-center p-4">
              This cycle has not been started yet
            </p>

            <Dialog open={startCycleOpen} onOpenChange={setStartCycleOpen}>
              <DialogTrigger asChild>
                <Button>+ Start cycle</Button>
              </DialogTrigger>
              <DialogContent className="h-3/5 overflow-auto">
                <DialogHeader>
                  <DialogTitle>Start cycle</DialogTitle>
                  <DialogDescription>
                    Optionally set custom values for your income
                  </DialogDescription>
                </DialogHeader>
                <form
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const formData = new FormData(ev.currentTarget);
                    handleStartCycleSubmit(formData);
                  }}
                >
                  <h4 className="font-semibold">
                    Incomes values{" "}
                    <small className="font-normal">(payment only)</small>
                  </h4>
                  <div className="p-3 bg-gray-200 rounded-sm mb-3">
                    {paymentIncomes.map((income) => (
                      <div key={income.id} className="space-y-2">
                        <Label htmlFor={`income-${income.id}`}>
                          {income.name}
                        </Label>
                        <Input
                          id={`income-${income.id}`}
                          name={`income-${income.id}`}
                          type="number"
                          step="0.01"
                          defaultValue={centsToRealAmountNotFormatted(
                            income.amount,
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <h4 className="font-semibold">
                    Debts values{" "}
                    <small className="font-normal">(variable only)</small>
                  </h4>
                  <div className="p-3 bg-gray-200 rounded-sm">
                    {variableDebts.map((debt) => (
                      <div key={debt.id} className="space-y-2">
                        <Label htmlFor={`debt-${debt.id}`}>{debt.name}</Label>
                        <Input
                          id={`debt-${debt.id}`}
                          name={`debt-${debt.id}`}
                          type="number"
                          step="0.01"
                          defaultValue={centsToRealAmountNotFormatted(
                            debt.amount,
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <Button type="submit" className="w-full mt-5">
                    {startCycleMutation.isPending && <Spinner />}
                    Confirm and start cycle
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Debts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Debts</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(debtsByOwner).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No debts for this cycle
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(debtsByOwner).map(([owner, data]) => (
                <div key={owner} className="border rounded-lg p-4 bg-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <CycleStatusToggler
                        currentStatus={data.status}
                        onStatusChange={(status) =>
                          toggleDebtOwnerStatus(owner, status)
                        }
                      />

                      <h3 className="font-semibold">{data.name}</h3>
                    </div>
                    <span className="text-danger font-semibold">
                      R$ {centsToRealAmount(data.total)}
                    </span>
                  </div>
                  <div className="space-y-2 bg-white rounded-md px-3 py-5">
                    {data.debts.map((debt) => (
                      <div
                        key={debt.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <CycleStatusToggler
                            currentStatus={debt.status}
                            onStatusChange={(status) =>
                              toggleDebtStatus(debt.id, status)
                            }
                          />

                          <span
                            className={
                              debt.status === "PAID"
                                ? "line-through text-muted-foreground"
                                : ""
                            }
                          >
                            {debt.name}{" "}
                            {debt.hasEnd && (
                              <>
                                (Installment {debt.installment_number}/
                                {debt.installments})
                              </>
                            )}
                          </span>
                        </div>
                        <Badge
                          variant={
                            debt.status === "paid" ? "default" : "secondary"
                          }
                        >
                          R$ {centsToRealAmount(debt.amount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incomes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Incomes</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(incomesByOwner).length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No incomes for this cycle
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(incomesByOwner).map(([payer, data]) => (
                <div key={payer} className="border rounded-lg p-4 bg-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <CycleStatusToggler
                        currentStatus={data.status}
                        onStatusChange={(status) =>
                          toggleIncomePayerStatus(payer, status)
                        }
                      />
                      <h3 className="font-semibold">{data.name}</h3>
                    </div>
                    <span className="text-success font-semibold">
                      R$ {centsToRealAmount(data.total)}
                    </span>
                  </div>
                  <div className="space-y-2 bg-white rounded-md px-3 py-5">
                    {data.incomes.map((income) => (
                      <div
                        key={income.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <CycleStatusToggler
                            currentStatus={income.status}
                            onStatusChange={(status) =>
                              toggleIncomeStatus(income.id, status)
                            }
                          />

                          <span
                            className={
                              income.status === "PAID"
                                ? "line-through text-muted-foreground"
                                : ""
                            }
                          >
                            {income.name} ({income.currency})
                          </span>
                        </div>
                        <Badge
                          variant={
                            income.status === "paid" ? "default" : "secondary"
                          }
                        >
                          R$ {centsToRealAmount(income.amount)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Expenses</CardTitle>
          <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
            {cycleData?.type === "materialized" && (
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expense</DialogTitle>
              </DialogHeader>
              <form onSubmit={addExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    name="category"
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    required
                  >
                    <option value="groceries">Groceries</option>
                    <option value="transportation">Transportation</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="utilities">Utilities</option>
                    <option value="health">Health</option>
                    <option value="education">Education</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    defaultValue={format(new Date(), "yyyy-MM-dd")}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {addExpenseMutation.isPending && <Spinner />}
                  Add Expense
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {(cycleData?.expenses?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No expenses for this cycle
            </p>
          ) : (
            <div className="space-y-2">
              {(cycleData?.expenses ?? []).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
                >
                  <div>
                    <div className="font-medium">{expense.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(expense.date), "MMM dd, yyyy")} •{" "}
                      {expense.category_name}
                    </div>
                  </div>
                  <div>
                    <span className="font-semibold">
                      R$ {centsToRealAmount(expense.amount)}
                    </span>
                    <Button
                      variant="outline"
                      className="ml-5"
                      onClick={() => deleteExpenseMutation.mutate(expense.id)}
                    >
                      <Trash2Icon className="text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
