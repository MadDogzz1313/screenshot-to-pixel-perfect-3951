import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isMissing, sb } from "./db";

export interface PendingLevelReward {
  reward_id: string;
  level: number;
  coins: number;
  awarded_at: string;
}

/** Serverbestätigte, noch nicht quittierte Levelaufstiege für die Animation. */
export function usePendingLevelRewards(userId: string | undefined) {
  return useQuery({
    queryKey: ["level-rewards", userId],
    enabled: !!userId,
    staleTime: 0,
    queryFn: async (): Promise<PendingLevelReward[] | null> => {
      const { data, error } = await sb.rpc("my_pending_level_rewards");
      if (error) {
        if (isMissing(error)) return null;
        throw error;
      }
      return (data ?? []) as PendingLevelReward[];
    },
  });
}

/** Quittiert nur die Anzeige; die Coin-Buchung ist bereits dauerhaft serverseitig erfolgt. */
export function useMarkLevelRewardsSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await sb.rpc("mark_level_rewards_seen");
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSettled: (_data, _error, _variables, _context) => {
      void qc.invalidateQueries({ queryKey: ["level-rewards"] });
      void qc.invalidateQueries({ queryKey: ["coin-balance"] });
    },
  });
}
