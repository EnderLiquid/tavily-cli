const tasks = new Set<Promise<unknown>>();

/** Register a background task. Rejections are swallowed; callers record their own errors. */
export function track(task: Promise<unknown>): void {
  const settled = task
    .catch(() => {})
    .finally(() => {
      tasks.delete(settled);
    });
  tasks.add(settled);
}

export function pendingCount(): number {
  return tasks.size;
}

/** Wait for registered tasks, up to `timeoutMs`. */
export async function drain(timeoutMs: number): Promise<void> {
  if (tasks.size === 0) return;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, Math.max(0, timeoutMs));
  });
  try {
    await Promise.race([Promise.allSettled([...tasks]), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
