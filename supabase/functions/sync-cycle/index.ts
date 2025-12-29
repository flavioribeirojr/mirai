// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "supabase-js";
import type { Database } from "../../../src/integrations/supabase/database.types.ts";
import { differenceInCalendarMonths, addMonths, startOfMonth, endOfMonth, format } from "date-fns";
import { calculateUSDToBRL } from "../../services/exchange-calculator.ts";

const supabase = createClient<Database>(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const auth = req.headers.get("authorization");
  console.log(auth)

  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [_, key] = auth.split(" ");

  if (key !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json();
  console.log("DB event received:", payload);

  const syncronizer = createCycleSyncronizer();

  switch (payload.table) {
    case "debts":
      await syncronizer.syncDebt(payload.record);
      break;
    case "incomes":
      await syncronizer.syncIncome(payload.record);
      break;
  }

  return new Response("OK");
});

function createCycleSyncronizer() {
  async function syncDebt(debt: Database['public']['Tables']['debts']['Row']) {
    const cycleDates: Date[] = [];
    const startDate = new Date(debt.first_payment_date);
    const endDate = debt.end_date ? new Date(debt.end_date) : null;

    if (!endDate) {
      cycleDates.push(startDate);
    } else {
      // Create array of dates starting from first payment date until end date
      // For example if a debt starts Jan 1 2026 and ends March 1 2026
      // the array will be [Jan 1 2026, Feb 1 2026, March 1 2026]
      cycleDates.push(...Array(differenceInCalendarMonths(endDate, startDate) + 1).fill(0).map((_, idx) => {
        return addMonths(startDate, idx);
      }));
    }

    await Promise.all(cycleDates.map(async cycleDate => {
      const currentStartDate = startOfMonth(cycleDate);
      const currentEndDate = endOfMonth(cycleDate);
      const { data: cycleData, error } = await supabase.from("materialized_cycles").select()
        .gte("date", format(currentStartDate, 'yyyy-MM-dd'))
        .lte("date", format(currentEndDate, 'yyyy-MM-dd'));

      if (error) {
        throw error;
      }

      const cycle = cycleData[0];
      if (!cycle) {
        console.log(`Cycle not found for ${cycleDate}`);
        return;
      };

      const { data: cycleDebtData, error: cycleDebtError } = await supabase.from("materialized_debts").select().eq("cycle_id", cycle.id).eq("debt_id", debt.id);

      if (cycleDebtError) {
        throw cycleDebtError;
      }

      const cycleDebt = cycleDebtData[0];
      let amount = debt.amount;

      if (debt.currency === 'USD') {
        amount = await calculateUSDToBRL(amount);
      }

      if (cycleDebt) {
        await supabase.from("materialized_debts").update({
          amount,
        }).eq("id", cycleDebt.id);
      } else {
        await supabase.from("materialized_debts").insert({
          cycle_id: cycle.id,
          debt_id: debt.id,
          amount,
          status: "PENDING",
        });
      }
    }));
  }

  async function syncIncome(income: Database['public']['Tables']['incomes']['Row']) {
    const cycleDates: Date[] = [];
    const startDate = new Date(income.first_income_date!);
    const endDate = income.end_date ? new Date(income.end_date) : null;

    if (!endDate) {
      cycleDates.push(startDate);
    } else {
      // Create array of dates starting from first payment date until end date
      // For example if a income starts Jan 1 2026 and ends March 1 2026
      // the array will be [Jan 1 2026, Feb 1 2026, March 1 2026]
      cycleDates.push(...Array(differenceInCalendarMonths(endDate, startDate) + 1).fill(0).map((_, idx) => {
        return addMonths(startDate, idx);
      }));
    }

    await Promise.all(cycleDates.map(async cycleDate => {
      const currentStartDate = startOfMonth(cycleDate);
      const currentEndDate = endOfMonth(cycleDate);
      const { data: cycleData, error } = await supabase.from("materialized_cycles").select()
        .gte("date", format(currentStartDate, 'yyyy-MM-dd'))
        .lte("date", format(currentEndDate, 'yyyy-MM-dd'));

      if (error) {
        throw error;
      }

      const cycle = cycleData[0];
      if (!cycle) {
        console.log(`Cycle not found for ${cycleDate}`)
      };

      const { data: cycleIncomeData, error: cycleIncomeError } = await supabase.from("materialized_incomes").select().eq("cycle_id", cycle.id).eq("income_id", income.id);

      if (cycleIncomeError) {
        throw cycleIncomeError;
      }

      const cycleIncome = cycleIncomeData[0];
      let amount = income.amount;

      if (income.currency === 'USD') {
        amount = await calculateUSDToBRL(amount);
      }

      if (cycleIncome) {
        await supabase.from("materialized_incomes").update({
          amount,
        }).eq("id", cycleIncome.id);
      } else {
        await supabase.from("materialized_incomes").insert({
          income_id: income.id,
          amount,
          status: "PENDING",
          cycle_id: cycle.id,
        });
      }
    }));
  }

  return {
    syncDebt,
    syncIncome,
  };
}
