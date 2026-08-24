// Diffs the shared scene and fans the diff out to registered Reactors.
// Port of upstream `Reconciler`, minus the CanvasKit handle.
//
// One-way binding only: reactors create LOCAL children for SHARED
// parents and never read local state back. Local children must be
// unselectable (or handled explicitly, as the opening overlay does)
// and must disable COPY attachment behaviour — anything that mutates
// them from outside this file puts the mapping out of sync.

import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { Patcher } from "./Patcher";
import type { Reactor } from "./Reactor";

export class Reconciler {
  private reactors: Reactor[] = [];
  private prevItems: Map<string, Item> = new Map();
  /** The snapshot being processed right now. Actors use it to look up
   *  a sibling item (e.g. a fog Path's parent map, for its grid dpi)
   *  without an async round-trip. */
  private currentItems: Map<string, Item> = new Map();
  private subscriptions: VoidFunction[] = [];

  patcher: Patcher = new Patcher();

  constructor() {
    OBR.scene.isReady().then(this.handleSceneReady).catch(() => {});
    this.subscriptions.push(
      OBR.scene.items.onChange(this.reconcile),
      OBR.scene.onReadyChange(this.handleSceneReady),
    );
  }

  delete() {
    for (const unsubscribe of this.subscriptions) {
      try {
        unsubscribe();
      } catch {}
    }
    this.subscriptions = [];
    for (const reactor of this.reactors) reactor.delete();
    this.reactors = [];
    this.prevItems.clear();
    void this.patcher.submitChanges();
  }

  private handleSceneReady = (ready: boolean) => {
    this.patcher.setReady(ready);
    if (ready) {
      OBR.scene.items
        .getItems()
        .then(this.reconcile)
        .catch(() => {});
    } else {
      // Scene swap wipes the local scene — drop every actor so the
      // next ready rebuilds from scratch.
      for (const reactor of this.reactors) reactor.delete();
      this.prevItems.clear();
      void this.patcher.submitChanges();
    }
  };

  private reconcile = (items: Item[]) => {
    this.currentItems.clear();
    for (const item of items) this.currentItems.set(item.id, item);

    for (const reactor of this.reactors) {
      this.processReactor(reactor, items);
    }
    void this.patcher.submitChanges();

    this.prevItems.clear();
    for (const item of items) this.prevItems.set(item.id, item);
  };

  /** Look up any item in the snapshot currently being reconciled. */
  getItem(id: string | undefined): Item | null {
    if (!id) return null;
    return this.currentItems.get(id) ?? this.prevItems.get(id) ?? null;
  }

  /** Force a full re-run against the current shared scene. Used when
   *  something outside the item stream changes what reactors should
   *  produce (role change, player-doors setting, grid dpi). */
  refresh() {
    OBR.scene.items
      .getItems()
      .then((items) => {
        // Treat everything as new so reactors rebuild their children.
        this.prevItems.clear();
        for (const reactor of this.reactors) reactor.delete();
        this.reconcile(items);
      })
      .catch(() => {});
  }

  register(...reactors: Reactor[]) {
    this.reactors.push(...reactors);
    for (const reactor of reactors) {
      const added: Item[] = [];
      for (const item of this.prevItems.values()) {
        if (reactor.filter(item)) added.push(item);
      }
      reactor.process(added, [], []);
    }
    void this.patcher.submitChanges();
  }

  unregister(...reactors: Reactor[]) {
    for (const reactor of reactors) {
      const index = this.reactors.indexOf(reactor);
      if (index >= 0) {
        this.reactors.splice(index, 1);
        reactor.delete();
      }
    }
    void this.patcher.submitChanges();
  }

  find<R extends Reactor>(ReactorClass: new (...args: any[]) => R): R | null {
    return (this.reactors.find((r) => r instanceof ReactorClass) as R) ?? null;
  }

  private processReactor(reactor: Reactor, items: Item[]) {
    const added: Item[] = [];
    const deleted: Item[] = [];
    const updated: Item[] = [];

    // Start from every previously seen id and strike off the ones that
    // still match. An item that survives but stops matching (moved off
    // the FOG layer, light metadata removed) therefore lands in
    // `deleted` and gets its children cleaned up.
    const deletedIds = new Set<string>(this.prevItems.keys());
    for (const item of items) {
      if (reactor.filter(item)) {
        const prev = this.prevItems.get(item.id);
        if (prev && reactor.has(item.id)) {
          if (reactor.diff(prev, item)) updated.push(item);
        } else {
          added.push(item);
        }
        deletedIds.delete(item.id);
      }
    }

    for (const id of deletedIds) {
      const prev = this.prevItems.get(id);
      if (prev && reactor.filter(prev)) deleted.push(prev);
    }

    reactor.process(added, deleted, updated);
  }
}
