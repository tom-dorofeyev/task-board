const DEFAULT_PORT = 3001;

export function configuredPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  if (!/^\d+$/.test(value)) throw new Error('PORT must be a positive integer');

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be a positive integer between 1 and 65535');
  }
  return port;
}
