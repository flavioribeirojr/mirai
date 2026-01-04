// Setup type definitions for built-in Supabase Runtime APIs
import "supabase-edge";
import { createClient } from "supabase-js";
import { z } from "zod";
import { startOfMonth, endOfMonth } from "date-fns";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { Database } from "../../../src/integrations/supabase/database.types.ts";
import { calculateUSDToBRL } from "../../services/exchange-calculator.ts";
import { corsHeaders } from '../../_shared/cors.ts';

const requestSchema = z.object({
  date: z.iso.date(),
  incomesOverride: z.array(z.object({
    incomeId: z.string(),
    amount: z.int() // In cents
  })).optional(),
  debtsOverride: z.array(z.object({
    debtId: z.string(),
    amount: z.int() // In cents
  })).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authorization = req.headers.get("authorization");
  if (!authorization) {
    return new Response("Missing authorization", { status: 401, headers: corsHeaders });
  }

  const [, token] = authorization.split(" ");

  const JWKS = createRemoteJWKSet(
    new URL("https://splendid-sawfly-13.clerk.accounts.dev/.well-known/jwks.json")
  );

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://splendid-sawfly-13.clerk.accounts.dev",
  });

  // payload.sub === Clerk user ID
  const clerkUserId = payload.sub;

  // Using authorization header to guarantee RLS
  const supabase = createClient<Database>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      global: {
        headers: {
          Authorization: authorization,
        }
      }
    }
  );

  const bodyToParse = await req.json()
  const body = z.parse(requestSchema, bodyToParse);

  const cycleDate = new Date(body.date);
  const startDate = startOfMonth(cycleDate).toISOString();
  const endDate = endOfMonth(cycleDate).toISOString();

  // RLS policy will make sure we can only see the user from same workspace
  const { data: usersData, error: userError } = await supabase.from("users").select().eq('auth_user_id', clerkUserId);

  if (userError || usersData.length === 0) {
    return new Response(`Error fetching user: ${userError?.message}`, {
      status: 401,
      headers: corsHeaders,
    });
  }

  const user = usersData[0];

  // Check if there is already a materizalied cycle for the date range

  // Fetch data
  const { data: debts, error: debtsError } = await supabase
    .from("debts")
    .select()
    .eq('workspace_id', user.workspace_id!)
    .or([
      `and(first_payment_date.gte.${startDate},first_payment_date.lte.${endDate})`,
      `and(first_payment_date.lte.${startDate},end_date.gte.${endDate})`,
      `and(first_payment_date.lte.${startDate},end_date.gte.${startDate},end_date.lte.${endDate})`,
      `and(has_end.eq.false,first_payment_date.gte.${startDate})`
    ].join(','));

  if (debtsError) {
    return new Response(`Failed loading debts: ${debtsError.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }

  const { data: incomes, error: incomesError } = await supabase
    .from("incomes")
    .select()
    .eq('workspace_id', user.workspace_id!)
    .or([
      `and(first_income_date.gte.${startDate},first_income_date.lte.${endDate})`,
      `and(first_income_date.lte.${startDate},end_date.gte.${endDate})`,
      `and(first_income_date.lte.${startDate},end_date.gte.${startDate},end_date.lte.${endDate})`,
      `and(is_recurrent.eq.true,first_income_date.lte.${startDate})`,
    ].join(','));

  if (incomesError) {
    return new Response(`Failed loading incomes: ${incomesError.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Create the cycle
  const { data: createdCycle, error: materializedCycleInsertError } = await supabase.from("materialized_cycles").insert({
    date: cycleDate.toISOString(),
    workspace_id: user.workspace_id,
  }).select().single()

  if (materializedCycleInsertError) {
    return new Response(`Failed to create cycle: ${materializedCycleInsertError.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }

  // Insert debts
  const debtsOverride: {[key: string]: number} = (body.debtsOverride ?? []).reduce((acc, override) => {
    return {
      ...acc,
      [override.debtId]: override.amount,
    };
  }, {})
  const mappedDebts = await Promise.all(debts.map(async debt => {
    let amount = debt.amount;

    if (debt.id in debtsOverride) {
      amount = debtsOverride[debt.id];
    } else if (debt.currency === 'USD') {
      // Calculate exchange
      amount = await calculateUSDToBRL(debt.amount);
    }

    return {
      debt_id: debt.id,
      cycle_id: createdCycle.id,
      amount,
      status: 'PENDING',
    }
  }));
  const { error: materializedDebtsCreateError } = await supabase.from("materialized_debts").insert(mappedDebts);

  if (materializedDebtsCreateError) {
    await supabase.from("materialized_cycles").delete().eq('id', createdCycle.id);
    return new Response(`Failed to create cycle debts: ${materializedDebtsCreateError.message}`, {
      status: 500,
      headers: corsHeaders
    });
  }

  // Insert incomes
  const incomesOverride: {[key: string]: number} = (body.incomesOverride ?? []).reduce((acc, override) => {
    return {
      ...acc,
      [override.incomeId]: override.amount,
    }
  }, {});

  const mappedIncomes = await Promise.all(incomes.map(async income => {
    let amount = income.amount;

    // If user specified another value for income use it instead
    // This is common when starting a cycle and doing exchange(for example USD -> BRL)
    if (income.id in incomesOverride) {
      amount = incomesOverride[income.id];
    } else if (income.currency === 'USD') {
      // Calculate exchange
      amount = await calculateUSDToBRL(income.amount);
    }
    return {
      income_id: income.id,
      cycle_id: createdCycle.id,
      amount,
      status: 'PENDING',
    };
  }))
  const { error: materializedIncomeCreateError } = await supabase.from("materialized_incomes").insert(mappedIncomes);

  if (materializedIncomeCreateError) {
    await supabase.from("materialized_cycles").delete().eq('id', createdCycle.id);
    return new Response(`Failed to create cycle incomes: ${materializedIncomeCreateError.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }

  return new Response(
    "Ok",
    {
      headers: corsHeaders,
    }
  )
})
