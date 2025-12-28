import { useSupabaseClient } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/database.types";
import { useAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import React, { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext<Tables<"users"> | null>(null);

export function useUserContext() {
  const context = useContext(UserContext);

  return context;
}

export function UserContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseClient = useSupabaseClient();
  const { userId } = useAuth();

  const { data: userData, refetch: refetchUserData } = useQuery({
    queryKey: ["getUser"],
    queryFn: async () => {
      if (!userId) {
        return null;
      }

      const { data, error } = await supabaseClient
        .from("users")
        .select(
          `
          *,
          workspace:workspaces (
            id,
            preferences (
              id,
              income_default_currency
            )
          )
        `,
        )
        .eq("auth_user_id", userId)
        .single();

      if (error) throw error;

      return data;
    },
  });

  useEffect(() => {
    if (!userId || userData) {
      return;
    }

    // Poll until auth user is found
    const interval = setInterval(() => {
      refetchUserData();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [userId, userData, refetchUserData]);

  return (
    <UserContext.Provider value={userData}>{children}</UserContext.Provider>
  );
}
