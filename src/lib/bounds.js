function reduceNested(node, depth, fn, acc) {
  if (depth === 0) return fn(acc, node);
  for (const child of node) acc = reduceNested(child, depth - 1, fn, acc);
  return acc;
}

export const min2d = (arr) => reduceNested(arr, 2, Math.min, Infinity);
export const max2d = (arr) => reduceNested(arr, 2, Math.max, -Infinity);
export const min3d = (arr) => reduceNested(arr, 3, Math.min, Infinity);
export const max3d = (arr) => reduceNested(arr, 3, Math.max, -Infinity);
