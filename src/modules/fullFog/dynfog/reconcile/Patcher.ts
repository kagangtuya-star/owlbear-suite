// Buffers local-scene mutations for one reconcile pass and flushes
// them as a single batched update. Port of upstream `Patcher`, with
// two hardening changes:
//
//   * the buffers are captured SYNCHRONOUSLY when `submitChanges()` is
//     called, so each reconcile pass owns a consistent batch;
//   * batches are applied in order via a promise chain, so a slow first
//     flush can't let a later pass's delete land before an earlier
//     pass's add of the same id.

import OBR, { type Item } from "@owlbear-rodeo/sdk";

interface Batch {
  additions: Item[];
  deletions: string[];
  updates: Map<string, ((item: Item) => void)[]>;
}

export class Patcher {
  private additions: Item[] = [];
  private deletions: string[] = [];
  private updates: Map<string, ((item: Item) => void)[]> = new Map();
  private ready = false;
  private queue: Promise<void> = Promise.resolve();

  setReady(ready: boolean) {
    this.ready = ready;
  }

  addItems(...items: Item[]) {
    this.additions.push(...items);
  }

  deleteItems(...ids: string[]) {
    this.deletions.push(...ids);
  }

  updateItems(...updates: [string, (item: Item) => void][]) {
    for (const [id, updater] of updates) {
      const values = this.updates.get(id);
      if (values) values.push(updater);
      else this.updates.set(id, [updater]);
    }
  }

  /** Hand the staged changes to OBR. Safe to call every pass. */
  submitChanges(): Promise<void> {
    if (
      this.additions.length === 0 &&
      this.deletions.length === 0 &&
      this.updates.size === 0
    ) {
      return this.queue;
    }
    const batch: Batch = {
      additions: this.additions,
      deletions: this.deletions,
      updates: this.updates,
    };
    this.additions = [];
    this.deletions = [];
    this.updates = new Map();
    this.queue = this.queue.then(() => this.flush(batch));
    return this.queue;
  }

  /** Deletes first so an id can be recycled within one pass, then
   *  adds, then updates. */
  private async flush(batch: Batch) {
    if (!this.ready) return;
    if (batch.deletions.length > 0) {
      try {
        await OBR.scene.local.deleteItems(batch.deletions);
      } catch (e) {
        console.warn("[dynfog] local delete failed", e);
      }
    }
    if (batch.additions.length > 0) {
      try {
        await OBR.scene.local.addItems(batch.additions);
      } catch (e) {
        console.warn("[dynfog] local add failed", e);
      }
    }
    if (batch.updates.size > 0) {
      try {
        await OBR.scene.local.updateItems([...batch.updates.keys()], (items) => {
          for (const item of items) {
            const fns = batch.updates.get(item.id);
            if (!fns) continue;
            for (const fn of fns) fn(item);
          }
        });
      } catch (e) {
        console.warn("[dynfog] local update failed", e);
      }
    }
  }
}
