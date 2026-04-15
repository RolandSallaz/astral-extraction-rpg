export function getDistanceToSegment(
  pointX: number,
  pointY: number,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared <= 0.0001) {
    return Math.hypot(pointX - startX, pointY - startY);
  }
  const projection = ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, projection));
  const closestX = startX + segmentX * clamped;
  const closestY = startY + segmentY * clamped;
  return Math.hypot(pointX - closestX, pointY - closestY);
}

export function getSegmentCircleCollisionT(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centerX: number,
  centerY: number,
  radius: number,
): number | null {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared <= 0.0001) {
    return Math.hypot(startX - centerX, startY - centerY) <= radius ? 0 : null;
  }

  const offsetX = startX - centerX;
  const offsetY = startY - centerY;
  const c = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (c <= 0) {
    return 0;
  }

  const b = 2 * (offsetX * deltaX + offsetY * deltaY);
  const discriminant = b * b - 4 * lengthSquared * c;
  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * lengthSquared);
  const second = (-b + root) / (2 * lengthSquared);
  if (first >= 0 && first <= 1) {
    return first;
  }
  if (second >= 0 && second <= 1) {
    return second;
  }
  return null;
}

export function getSegmentEllipseCollisionT(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
): number | null {
  return getSegmentCircleCollisionT(
    (startX - centerX) / Math.max(0.001, halfWidth),
    (startY - centerY) / Math.max(0.001, halfHeight),
    (endX - centerX) / Math.max(0.001, halfWidth),
    (endY - centerY) / Math.max(0.001, halfHeight),
    0,
    0,
    1,
  );
}
