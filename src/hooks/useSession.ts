import { useSession as clerkUseSession } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';

export function useSession() {
  const session = clerkUseSession();
  const { data: sessionToken } = useQuery({
    queryKey: ['user-session-token'],
    queryFn: getSessionToken,
  })

  async function getSessionToken() {
    const token = await session?.session.getToken({ template: 'supabase' });

    return token;
  }

  return {
    sessionToken,
    getSessionToken,
  };
}
