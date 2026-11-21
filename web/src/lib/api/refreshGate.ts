/**
 * Serialize refresh work that can be triggered from several places.
 *
 * The sidebar refreshes on mount and again on save events. While one refresh is
 * running, later triggers are coalesced into at most one follow-up run instead
 * of issuing duplicate simultaneous requests. The follow-up is forced when any
 * coalesced trigger was forced, so a save that arrives during a plain refresh
 * still bypasses the read cache.
 */

export type RefreshTask = (force: boolean) => Promise<void>;

export interface RefreshGate {
  /** Run (or queue) one refresh. `force` bypasses the caller's read cache. */
  run(force?: boolean): Promise<void>;
}

export function createRefreshGate(task: RefreshTask): RefreshGate {
  let running = false;
  let queued = false;
  let queuedForce = false;

  const run = async (force: boolean): Promise<void> => {
    running = true;
    let failure: unknown;
    try {
      await task(force);
    } catch (error) {
      failure = error;
    } finally {
      running = false;
    }

    if (queued) {
      const nextForce = queuedForce;
      queued = false;
      queuedForce = false;
      await run(nextForce);
    }

    if (failure) {
      throw failure;
    }
  };

  return {
    run(force = false) {
      if (running) {
        queued = true;
        queuedForce = queuedForce || force;
        return Promise.resolve();
      }

      return run(force);
    },
  };
}
