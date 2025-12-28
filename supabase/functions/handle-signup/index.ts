// Setup type definitions for built-in Supabase Runtime APIs
import "supabase-edge"
import { Webhook } from "svix";
import { createClient } from "supabase-js";
import type { Database } from "../../../src/integrations/supabase/database.types.ts";
import type { WebhookEvent } from "clerk";

const supabase = createClient<Database>(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  const wh = new Webhook(Deno.env.get("CLERK_WEBHOOK_SECRET")!);

  try {
    const event = wh.verify(payload, headers) as WebhookEvent;

    if (event.type === "user.created") {
      const user = event.data;
      const {
        data: workspaceCreateData,
        error: workspaceCreateError
      } = await supabase.from('workspaces').insert({}).select();

      const workspaceId = workspaceCreateData?.[0].id;
      if (!workspaceId) {
        throw new Error(`Error creating workspace: ${workspaceCreateError}`);
      }

      const { error: userCreateError } = await supabase.from("users").insert({
        email: user.email_addresses[0].email_address,
        name: `${user.first_name ?? ''}`,
        auth_user_id: user.id,
        workspace_id: workspaceId,
      });

      if (userCreateError) {
        throw new Error(`Error creating user: ${userCreateError}`);
      }
    }
    return new Response("OK", { status: 200 });
  } catch (err: unknown) {
    let msg = '';

    if (err instanceof Error) {
      msg = err.message;
    }

    return new Response(`Webhook error: ${msg}`, { status: 400 });
  }
})
