import { useSupabaseClient } from "@/integrations/supabase/client";
import { useSession } from "./useSession";

export function useSupabaseFunction({
  functionName,
}: {
  functionName: string;
}) {
  const session = useSession();
  const supabase = useSupabaseClient();

  async function invoke<T = object>(body: T) {
    const token = await session.getSessionToken();
    const { error, data } = await supabase.functions.invoke(functionName, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (error) throw error;

    return data;
  }

  return {
    invoke
  };
}
