// Item ↔ world coordinate transforms.
//
// Port of upstream `src/background/util/math.ts`, plus a cached
// matrix helper so a drag loop doesn't rebuild the same matrix on
// every pointer move.

import { MathM, type Item, type Matrix, type Vector2 } from "@owlbear-rodeo/sdk";

/** Transform matrix of an item (position · rotation · scale). */
export function itemMatrix(item: Item): Matrix {
  return MathM.fromItem(item);
}

/** item-local point → world point. */
export function transformPoint(matrix: Matrix, point: Vector2): Vector2 {
  const p = MathM.fromPosition(point);
  return MathM.decompose(MathM.multiply(matrix, p)).position;
}

/** world point → item-local point. */
export function inverseTransformPoint(
  matrix: Matrix,
  point: Vector2,
): Vector2 {
  const p = MathM.fromPosition(point);
  const inverse = MathM.inverse(matrix);
  return MathM.decompose(MathM.multiply(inverse, p)).position;
}

/** Uniform-ish world scale factor of a matrix, used to convert a
 *  world-space distance threshold (e.g. the door tool's 75px snap)
 *  into the item's local units. Non-uniform scales fall back to the
 *  geometric mean, which is the best single number available. */
export function matrixScaleFactor(matrix: Matrix): number {
  const { scale } = MathM.decompose(matrix);
  const sx = Math.abs(scale.x) || 1;
  const sy = Math.abs(scale.y) || 1;
  return Math.sqrt(sx * sy) || 1;
}
