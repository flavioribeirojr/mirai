import { z } from "zod";
import { calculateUSDToBRL } from "../../services/exchange-calculator.ts";
import { handleRequestAuthorization } from "../../services/authorizer.ts";
import { corsHeaders } from '../../_shared/cors.ts';

const requestSchema = z.object({
  amountInUSDCents: z.number(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  await handleRequestAuthorization(req);

  const bodyToParse = await req.json()
  const body = z.parse(requestSchema, bodyToParse);
  const amountInBRLCents = await calculateUSDToBRL(body.amountInUSDCents);
  return new Response(
    JSON.stringify({ amountInBRLCents }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } },
  )
});
