/**
 * The pointer cursor over the canvas, shared by the layers whose marks can be clicked -- the
 * exoplanet hosts' rings, the pulsars, the globular clusters. Each says whether the pointer
 * is over one of its own marks; the cursor is the hand while any of them is. Each setting it
 * alone, the last to look each frame won, and a layer with nothing under the pointer put the
 * arrow back over another's mark.
 */

const pointing = new Map<HTMLElement, Set<string>>();

/** Says whether `owner` has a mark under the pointer on `element`, and sets the cursor. */
export function setMarkerPointer(element: HTMLElement, owner: string, on: boolean): void {
  let owners = pointing.get(element);
  if (owners === undefined) {
    owners = new Set();
    pointing.set(element, owners);
  }
  if (on) {
    owners.add(owner);
  } else {
    owners.delete(owner);
  }
  element.style.cursor = owners.size > 0 ? 'pointer' : '';
}
