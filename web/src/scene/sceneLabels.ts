import type * as THREE from 'three';

import { boxOf, labelBoard } from './labelBoard.ts';
import { projectToScreen } from './screenProjection.ts';

/**
 * Names of things that are not bodies -- a stellar stream, a bubble, the Radcliffe Wave --
 * laid over the canvas by the scene component that draws them, in the Milky Way model's quiet
 * italic (App.tsx GALAXY_LABEL_STYLE): they name parts of a map, not places to go.
 *
 * The component owns the elements: made here, in a layer of their own over the canvas, and
 * each frame placed and posted to the labels' one declutter pass (labelBoard.ts), which shows
 * those that win and hides those that lose. Mount the component before LabelProjector, whose
 * frame runs after it.
 *
 * **Written only when it changes.** Each name's place and opacity are kept as last written,
 * and written again only when they differ; a name is not shown here but by the declutter pass,
 * so one that keeps losing its spot is not shown and hidden again every frame; and which names
 * may be showing is kept here too, so hiding a layer's names that are all hidden already asks
 * nothing of the page. Each of those was a trip through the style system, every frame, for
 * every name of the layer: from half a millisecond a frame among the stellar streams' names.
 */

const STYLE: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '0',
  left: '0',
  display: 'none',
  color: '#9aa4b4',
  fontStyle: 'italic',
  fontSize: '0.64rem',
  letterSpacing: '0.12em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};

/** A name's place and opacity as last written into its element; NaN for never. */
interface Written {
  x: number;
  y: number;
  opacity: number;
}

export class SceneLabels {
  private readonly layer: HTMLDivElement | null;
  private readonly elements: HTMLSpanElement[];
  private readonly written: Written[];
  /**
   * Whether each name may be showing: 1 from its posting -- the declutter pass shows it if it
   * wins -- until it is hidden here. Only LabelProjector shows a posted name, so a 0 is known
   * hidden and needs no look at its element.
   */
  private readonly mayShow: Uint8Array;
  private projected: THREE.Vector3 | null = null;

  /**
   * `canvas` is the renderer's (useThree().gl.domElement): the names go in a layer beside it.
   * `key` keeps them apart from every other poster's on the board. `rank` as a body's label's
   * (LabelProjector labelRank): 1, a moon's, unless the names should yield to more.
   */
  constructor(
    canvas: HTMLCanvasElement,
    names: readonly string[],
    private readonly key: string,
    private readonly rank = 1,
  ) {
    const host = canvas.parentElement?.parentElement ?? canvas.parentElement ?? null;
    if (host === null || typeof document === 'undefined') {
      this.layer = null;
      this.elements = [];
      this.written = [];
      this.mayShow = new Uint8Array(0);
      return;
    }
    const layer = document.createElement('div');
    Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    this.elements = names.map((name) => {
      const element = document.createElement('span');
      element.className = 'tracks-scene';
      element.textContent = name;
      Object.assign(element.style, STYLE);
      layer.appendChild(element);
      return element;
    });
    this.written = names.map(() => ({ x: NaN, y: NaN, opacity: NaN }));
    this.mayShow = new Uint8Array(names.length);
    host.appendChild(layer);
    this.layer = layer;
  }

  get count(): number {
    return this.elements.length;
  }

  hide(index: number): void {
    const element = this.elements[index];
    if (element === undefined || this.mayShow[index] === 0) return;
    this.mayShow[index] = 0;
    if (element.style.display !== 'none') {
      element.style.display = 'none';
    }
  }

  hideAll(): void {
    for (let i = 0; i < this.elements.length; i += 1) this.hide(i);
  }

  /**
   * Puts name `index` centred on `point` (scene units, camera-relative as the scene is) at
   * `opacity`, and posts it to the declutter pass, which shows it if it wins; hidden where the
   * point is off screen or behind the camera, or the opacity is nothing. `importance` orders
   * names within the rank.
   */
  place(
    index: number,
    point: THREE.Vector3,
    camera: THREE.Camera,
    size: { width: number; height: number },
    opacity: number,
    importance = 0,
  ): boolean {
    const element = this.elements[index];
    if (element === undefined) return false;
    if (opacity <= 0.01) {
      this.hide(index);
      return false;
    }
    const projected = this.projected === null ? (this.projected = point.clone()) : this.projected;
    if (!projectToScreen(point, camera, projected) || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) {
      this.hide(index);
      return false;
    }
    const x = (projected.x * 0.5 + 0.5) * size.width;
    const y = (-projected.y * 0.5 + 0.5) * size.height;
    const written = this.written[index]!;
    if (written.x !== x || written.y !== y) {
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      written.x = x;
      written.y = y;
    }
    const shownOpacity = Math.min(1, opacity);
    if (written.opacity !== shownOpacity) {
      element.style.opacity = String(shownOpacity);
      written.opacity = shownOpacity;
    }
    let box = boxOf(element);
    if (box.width === 0 && element.style.display === 'none') {
      // Never measured: a hidden element has no box. Shown to be measured, once per text --
      // where it is, at its opacity -- and left to the declutter pass like any other.
      element.style.display = 'block';
      box = boxOf(element);
    }
    this.mayShow[index] = 1;
    labelBoard.posted.push({
      key: `${this.key}-${index}`,
      element,
      x,
      y,
      offset: -box.width / 2,
      dy: 0,
      width: box.width,
      height: box.height,
      rank: this.rank,
      importance,
      marked: false,
    });
    return true;
  }

  dispose(): void {
    this.layer?.remove();
  }
}
