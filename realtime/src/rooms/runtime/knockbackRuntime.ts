export function pushTargetByKnockback(
  fromX: number,
  fromY: number,
  target: { x: number; y: number },
  knockbackDistance: number,
  applyPosition: (x: number, y: number) => void,
) {
  if (knockbackDistance <= 0) {
    return;
  }
  const deltaX = target.x - fromX;
  const deltaY = target.y - fromY;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 0.001) {
    return;
  }
  const nextX = target.x + (deltaX / distance) * knockbackDistance;
  const nextY = target.y + (deltaY / distance) * knockbackDistance;
  applyPosition(nextX, nextY);
}
