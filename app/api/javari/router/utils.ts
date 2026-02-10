export const now = () => Date.now();

export const measure = async (fn: () => Promise<any>) => {
  const start = now();
  const output = await fn();
  return { output, duration: now() - start };
};

export const safe = async (fn: () => Promise<any>) => {
  try {
    return await fn();
  } catch (err: any) {
    return { error: err.message || "Unhandled routing error." };
  }
};
