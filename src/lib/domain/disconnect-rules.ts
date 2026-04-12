type IsDisconnectedParams = {
  lastSeenAt: string;
  now: Date;
  disconnectThresholdSeconds: number;
};

export function isDisconnected({
  lastSeenAt,
  now,
  disconnectThresholdSeconds,
}: IsDisconnectedParams): boolean {
  const lastSeenAtMs = Date.parse(lastSeenAt);
  const elapsedMs = now.getTime() - lastSeenAtMs;

  return elapsedMs >= disconnectThresholdSeconds * 1_000;
}
