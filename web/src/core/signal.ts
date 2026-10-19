/**
 * Something that happens, over and over, that a few parts of the app want to hear about.
 *
 * Made for the readout cadence. It used to be a counter in `App`'s own state, bumped ten
 * times a second, and everything below `App` re-rendered with it: five hundred label
 * buttons, each with a fresh ref callback that React detached and reattached, the body
 * picker, every panel -- to change a few digits in three of them. JavaScript was about
 * 75 % of a frame on the reference laptop, and that was the largest share of it that did
 * not draw anything.
 *
 * Now the cadence is this, and the few components that show a number that moves with
 * the clock subscribe to it themselves (see `useSignal`). Nothing else re-renders.
 *
 * `count` is how many times it has fired. It is what makes it a store React can read
 * with `useSyncExternalStore`: a snapshot that changes exactly when there is news.
 */
export class Signal {
  readonly #listeners = new Set<() => void>();
  #count = 0;

  /** How many times this has fired. */
  get count(): number {
    return this.#count;
  }

  /**
   * Calls `listener` on every `emit`; returns the unsubscribe.
   *
   * An arrow property rather than a method, so it can be handed to
   * `useSyncExternalStore` as it is, without a bind that would make a new function --
   * and with it a new subscription -- on every render.
   */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Fires: counts, then tells every listener subscribed when it started. */
  emit(): void {
    this.#count += 1;
    // A copy, so a listener that unsubscribes itself -- or another -- while being told
    // cannot make the walk skip or repeat anyone.
    for (const listener of [...this.#listeners]) {
      listener();
    }
  }
}
