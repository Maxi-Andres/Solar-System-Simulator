import type * as THREE from 'three';

import { boxOf, labelBoard } from './labelBoard.ts';
import { projectToScreen } from './screenProjection.ts';

/**
 * Names of things that are not bodies -- a stellar stream, a bubble, the Radcliffe Wave --
 * laid over the canvas by the scene component that draws them, in the Milky Way model's quiet
 * italic (App.tsx GALAXY_LABEL_STYLE): they name parts of a map, not places to go.
 *
 * The component owns the elements: made here, in a layer of their own over the canvas, and
 * each frame placed and posted to the labels' one declutter pass (labelBoard.ts), which hides
 * those that lose. Mount the component before LabelProjector, whose frame runs after it.
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

const scratch = { x: 0, y: 0 };

export class SceneLabels {
  private readonly layer: HTMLDivElement | null;
  private readonly elements: HTMLSpanElement[];

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
    host.appendChild(layer);
    this.layer = layer;
  }

  get count(): number {
    return this.elements.length;
  }

  hide(index: number): void {
    const element = this.elements[index];
    if (element !== undefined && element.style.display !== 'none') {
      element.style.display = 'none';
    }
  }

  hideAll(): void {
    for (let i = 0; i < this.elements.length; i += 1) this.hide(i);
  }

  /**
   * Puts name `index` centred on `point` (scene units, camera-relative as the scene is) at
   * `opacity`, and posts it to the declutter pass; hidden where the point is off screen or
   * behind the camera, or the opacity is nothing. `importance` orders names within the rank.
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
    const projected = point.clone();
    if (!projectToScreen(point, camera, projected) || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) {
      this.hide(index);
      return false;
    }
    scratch.x = (projected.x * 0.5 + 0.5) * size.width;
    scratch.y = (-projected.y * 0.5 + 0.5) * size.height;
    if (element.style.display !== 'block') element.style.display = 'block';
    element.style.transform = `translate(${scratch.x}px, ${scratch.y}px) translate(-50%, -50%)`;
    element.style.opacity = String(Math.min(1, opacity));
    const box = boxOf(element);
    labelBoard.posted.push({
      key: `${this.key}-${index}`,
      element,
      x: scratch.x,
      y: scratch.y,
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
