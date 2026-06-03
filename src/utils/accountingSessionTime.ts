export const getEffectiveAccountingSessionEnd = (
  periodEnd: string,
  completedAt?: string | null,
) => {
  if (!completedAt) return periodEnd;

  const periodEndMs = new Date(periodEnd).getTime();
  const completedAtMs = new Date(completedAt).getTime();

  if (Number.isNaN(completedAtMs)) return periodEnd;
  if (Number.isNaN(periodEndMs)) return completedAt;

  return completedAtMs > periodEndMs ? completedAt : periodEnd;
};