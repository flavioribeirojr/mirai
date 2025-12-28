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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PencilLine, Plus, Trash2 } from "lucide-react";
import { format, addMonths } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "@/hooks/useUser";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { centsToRealAmount, toCents } from "@/lib/utils";
import { SearchBar } from "@/components/feat/SearchBar";
import { SimplePagination } from "@/components/feat/SimplePagination";
import {
  IncomeFormModal,
  FormValues as IncomeFormValues,
} from "@/components/feat/IncomeFormModal";

const PAGE_LIMIT = 10;

export default function Incomes() {
  const supabaseClient = useSupabaseClient();
  const user = useUserContext();
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);

  const { data: incomesData, refetch: refetchIncomes } = useQuery({
    queryKey: ["getIncomes", user?.id, search, skip],
    queryFn: async () => {
      if (!user) {
        return null;
      }

      let query = supabaseClient
        .from("incomes")
        .select(
          `
          *,
          payer:income_payers(
            id,
            name,
            type
          )
        `,
          { count: "exact" },
        )
        .eq("workspace_id", user.workspace_id);

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error, count } = await query
        .range(skip, skip + PAGE_LIMIT)
        .limit(PAGE_LIMIT);

      if (error) throw error;

      return { data, count };
    },
  });
  const incomes = useMemo(() => {
    if (!incomesData?.data) return [];

    return incomesData.data.map((income) => {
      let endDate: Date | null = null;

      if (!income.is_recurrent) {
        const firstPaymentDate = new Date(income.first_income_date);
        // Remove 1 as the first payment date already account for the first payment
        endDate = addMonths(firstPaymentDate, income.number_of_payments - 1);
      }

      return {
        ...income,
        endDate,
      };
    });
  }, [incomesData]);

  const { data: incomePayersData, refetch: refetchIncomePayers } = useQuery({
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
  const incomePayers = useMemo(() => {
    if (!incomePayersData) return [];

    return incomePayersData;
  }, [incomePayersData]);
  const [payerDialogOpen, setPayerDialogOpen] = useState(false);
  const { toast } = useToast();

  const addIncomePayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (!user) return;

    const { error } = await supabaseClient.from("income_payers").insert({
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
      toast({ title: "Success", description: "Income payer added" });
      setPayerDialogOpen(false);
      refetchIncomePayers();
    }
  };

  const deleteIncome = async (id: string) => {
    const confirmed = window.confirm("Delete this income?");
    if (!confirmed) return;

    const { error } = await supabaseClient
      .from("incomes")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({ title: "Success", description: "Income deleted" });
      refetchIncomes();
    }
  };

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editIncomeId, setEditIncomeId] = useState<string | null>(null);

  function addOrUpdateIncome(values: IncomeFormValues) {
    if (editIncomeId) {
      updateIncome(values);
    } else {
      addIncome(values);
    }
  }

  async function updateIncome(values: IncomeFormValues) {
    if (!user || !editIncomeId) return;

    const { error } = await supabaseClient
      .from("incomes")
      .update({
        workspace_id: user.workspace_id,
        payer_id: values.payerId,
        name: values.name,
        amount: toCents(values.amount),
        currency: values.currency,
        is_recurrent: values.isRecurrent,
        number_of_payments: values.isRecurrent ? 1 : values.numberOfPayments,
        first_income_date: format(values.firstIncomeDate, "yyyy-MM-dd"),
      })
      .eq("id", editIncomeId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({ title: "Success", description: "Income added successfully" });
      refetchIncomes();
      setIsIncomeModalOpen(false);
      setEditIncomeId(null);
    }
  }

  async function addIncome(values: IncomeFormValues) {
    if (!user) return;

    const { error } = await supabaseClient.from("incomes").insert({
      workspace_id: user.workspace_id,
      payer_id: values.payerId,
      name: values.name,
      amount: toCents(values.amount),
      currency: values.currency,
      is_recurrent: values.isRecurrent,
      number_of_payments: values.isRecurrent ? 1 : values.numberOfPayments,
      first_income_date: format(values.firstIncomeDate, "yyyy-MM-dd"),
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({ title: "Success", description: "Income added successfully" });
      refetchIncomes();
      setIsIncomeModalOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Management</h1>
          <p className="text-muted-foreground">
            Track your income sources and payments
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={payerDialogOpen} onOpenChange={setPayerDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Payer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Income Payer</DialogTitle>
              </DialogHeader>
              <form onSubmit={addIncomePayer} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payer-name">Name</Label>
                  <Input id="payer-name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payer-type">Type</Label>
                  <select
                    id="payer-type"
                    name="type"
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    required
                  >
                    <option value="company">Company</option>
                    <option value="person">Person</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  Add Payer
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <IncomeFormModal
            incomeId={editIncomeId}
            isOpen={isIncomeModalOpen}
            onOpenChanged={setIsIncomeModalOpen}
            incomePayers={incomePayers}
            onSubmit={addOrUpdateIncome}
          />
        </div>
      </div>
      <SearchBar onSearch={setSearch} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Payer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Payments</TableHead>
            <TableHead>First payment dt.</TableHead>
            <TableHead>End date</TableHead>
            <TableHead className="text-center">🎛️</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incomes.map((income) => (
            <TableRow key={income.id}>
              <TableCell>{income.name}</TableCell>
              <TableCell>
                {income.is_recurrent ? "Recurrent" : "Fixed"}
              </TableCell>
              <TableCell>{income.payer.name}</TableCell>
              <TableCell>
                {centsToRealAmount(income.amount)}{" "}
                {income.currency.toUpperCase()}
              </TableCell>
              <TableCell>
                {income.is_recurrent ? "N/A" : income.number_of_payments}
              </TableCell>
              <TableCell>
                {format(new Date(income.first_income_date), "MMM dd, yyyy")}
              </TableCell>
              <TableCell>
                {income.endDate
                  ? format(income.endDate, "MMM dd, yyyy")
                  : "N/A"}
              </TableCell>
              <TableCell className="text-center">
                <Button
                  variant="link"
                  className="p-0"
                  onClick={() => {
                    setEditIncomeId(income.id);
                    setIsIncomeModalOpen(true);
                  }}
                >
                  <PencilLine size={18} />
                </Button>
                <Button variant="link" onClick={() => deleteIncome(income.id)}>
                  <Trash2 color="red" size={18} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {incomes.length > 0 && (
        <SimplePagination
          skip={skip}
          setSkip={setSkip}
          limit={PAGE_LIMIT}
          count={incomesData?.count ?? 0}
        />
      )}

      {incomes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No income sources yet. Add your first income to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
