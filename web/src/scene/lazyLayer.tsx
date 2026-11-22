import { useFrame as useCanvasFrame, type RenderCallback } from '@react-three/fiber';
import {
  Component,
  createContext,
  createElement,
  lazy,
  Suspense,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

/**
 * The scene's far layers, loaded as their own chunks, and run in the frame where they
 * would have run had they been in the main one.
 *
 * Laniakea, the cosmic web, the quasars, the CMB and the rest are code and shaders that
 * the Solar System, where every visit starts, never draws. Imported statically they were
 * in the main chunk, parsed before the first frame; through `lazyLayer` each is a chunk
 * fetched on its own -- at once, beside the startup data, for a layer on from the start,
 * or the first time it is switched on for one that starts off.
 *
 * **Their frames, in order.** react-three-fiber runs frame callbacks of the same priority
 * in the order they subscribed, and a component subscribes when it mounts -- so a layer
 * that mounted late, once its chunk was in, would run after LabelProjector and CameraRig,
 * and the names it posts to the labels' declutter (labelBoard.ts) would land a frame late.
 * A `LazyLayer` subscribes when *it* mounts, in its place in the tree with everything else,
 * and runs the frame callbacks of what loads inside it there: each lazy layer's file takes
 * `useFrame` from here instead of from react-three-fiber, which outside a LazyLayer is
 * react-three-fiber's own.
 */

class FrameSlot {
  readonly callbacks: { current: RenderCallback }[] = [];

  add(callback: { current: RenderCallback }): () => void {
    this.callbacks.push(callback);
    return () => {
      const at = this.callbacks.indexOf(callback);
      if (at >= 0) this.callbacks.splice(at, 1);
    };
  }

  run(...args: Parameters<RenderCallback>): void {
    for (const callback of this.callbacks) {
      callback.current(...args);
    }
  }
}

const SlotContext = createContext<FrameSlot | null>(null);

/**
 * react-three-fiber's `useFrame`, run in the enclosing LazyLayer's place in the frame. With
 * no LazyLayer about it, or a priority of its own, it is react-three-fiber's.
 */
export function useFrame(callback: RenderCallback, priority = 0): void {
  const slot = useContext(SlotContext);
  const inSlot = slot !== null && priority === 0;
  const latest = useRef(callback);
  useLayoutEffect(() => {
    latest.current = callback;
  }, [callback]);
  useLayoutEffect(() => (inSlot ? slot.add(latest) : undefined), [slot, inSlot]);
  useCanvasFrame((...args) => {
    if (!inSlot) latest.current(...args);
  }, priority);
}

/** LazyLayers whose chunk has not come in yet; see whenLayersArrived. */
const pending = new Set<{ arrived: boolean }>();
const waiting = new Set<() => void>();

function release(token: { arrived: boolean }): void {
  if (!pending.delete(token) || pending.size > 0) return;
  for (const callback of [...waiting]) callback();
  waiting.clear();
}

function arrive(token: { arrived: boolean }): void {
  token.arrived = true;
  release(token);
}

/**
 * Calls `callback` once no LazyLayer mounted so far is still waiting for its chunk -- at
 * once if none is. ShaderWarmup waits on it, so the first frame's programs include those of
 * the far layers on from the start. Returns a cancel.
 */
export function whenLayersArrived(callback: () => void): () => void {
  if (pending.size === 0) {
    callback();
    return () => undefined;
  }
  waiting.add(callback);
  return () => waiting.delete(callback);
}

function Arrived({ token }: { readonly token: { arrived: boolean } }) {
  useLayoutEffect(() => arrive(token), [token]);
  return null;
}

/**
 * A layer whose chunk could not be fetched -- a network failure, or a deploy that replaced
 * it -- is left out, as if switched off, rather than taking the whole canvas down with it.
 */
class LayerBoundary extends Component<{ readonly children: ReactNode; readonly onFail: () => void }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    console.error('Could not load a layer of the scene', error);
    this.props.onFail();
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

/** Where a lazily loaded layer goes in the scene: its place in the frame, and its chunk's wait. */
export function LazyLayer({ children }: { readonly children: ReactNode }) {
  const slot = useMemo(() => new FrameSlot(), []);
  useCanvasFrame((...args) => slot.run(...args));
  const token = useMemo(() => ({ arrived: false }), []);
  useLayoutEffect(() => {
    if (!token.arrived) pending.add(token);
    return () => release(token);
  }, [token]);
  return (
    <SlotContext.Provider value={slot}>
      <LayerBoundary onFail={() => arrive(token)}>
        <Suspense fallback={null}>
          {children}
          <Arrived token={token} />
        </Suspense>
      </LayerBoundary>
    </SlotContext.Provider>
  );
}

/**
 * A layer component from its own chunk. `preload` fetches the chunk now, for a layer that is
 * on from the start, so it is usually in before the canvas first renders it; otherwise it is
 * fetched when the layer is first rendered. Render it inside a LazyLayer.
 */
export function lazyLayer<P extends object>(
  load: () => Promise<ComponentType<P>>,
  preload = false,
): ComponentType<P> {
  let loaded: ComponentType<P> | null = null;
  let request: Promise<{ default: ComponentType<P> }> | null = null;
  const start = (): Promise<{ default: ComponentType<P> }> =>
    (request ??= load().then((component) => {
      loaded = component;
      return { default: component };
    }));
  const Suspending = lazy(start);
  if (preload) {
    // A failure is reported when the layer renders and the boundary catches it.
    start().catch(() => undefined);
  }
  function Layer(props: P) {
    // Chosen once per mount, so a layer that arrived through the lazy wrapper is not
    // remounted when a later render finds the component already loaded.
    const [direct] = useState(() => loaded);
    return direct !== null ? createElement(direct, props) : createElement(Suspending as ComponentType<P>, props);
  }
  return Layer;
}

/** True from the first render `on` is, for good: a layer mounted once switched on, then kept. */
export function useOnceOn(on: boolean): boolean {
  const ever = useRef(on);
  ever.current ||= on;
  return ever.current;
}
