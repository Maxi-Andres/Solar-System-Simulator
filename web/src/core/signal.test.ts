import { describe, expect, it } from 'vitest';

import { Signal } from './signal.ts';

describe('Signal', () => {
  it('counts every firing, heard or not', () => {
    const signal = new Signal();
    expect(signal.count).toBe(0);
    signal.emit();
    signal.emit();
    expect(signal.count).toBe(2);
  });

  it('tells every listener, and stops telling one that unsubscribed', () => {
    const signal = new Signal();
    const heard: string[] = [];
    const stopA = signal.subscribe(() => heard.push('a'));
    signal.subscribe(() => heard.push('b'));

    signal.emit();
    expect(heard).toEqual(['a', 'b']);

    stopA();
    signal.emit();
    expect(heard).toEqual(['a', 'b', 'b']);
  });

  it('has the count already moved on when a listener hears it', () => {
    // What useSyncExternalStore relies on: the snapshot read in the listener is new.
    const signal = new Signal();
    let seen = -1;
    signal.subscribe(() => {
      seen = signal.count;
    });
    signal.emit();
    expect(seen).toBe(1);
  });

  it('survives a listener unsubscribing itself, or another, in the middle of a firing', () => {
    const signal = new Signal();
    const heard: string[] = [];
    let stopB = (): void => {};
    const stopA = signal.subscribe(() => {
      heard.push('a');
      stopA();
      stopB();
    });
    stopB = signal.subscribe(() => heard.push('b'));

    // Everyone subscribed when it fired is told this once; neither is told again.
    signal.emit();
    signal.emit();
    expect(heard).toEqual(['a', 'b']);
  });

  it('can be subscribed to without being bound', () => {
    // Handed to useSyncExternalStore as `signal.subscribe`, detached from the instance.
    const signal = new Signal();
    const { subscribe } = signal;
    let heard = 0;
    subscribe(() => (heard += 1));
    signal.emit();
    expect(heard).toBe(1);
  });
});
