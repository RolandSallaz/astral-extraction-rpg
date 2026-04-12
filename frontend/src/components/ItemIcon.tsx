'use client';

import type { CSSProperties } from 'react';
import { type ItemDefinition } from '@/lib/items/equipmentItems';
import { cn } from '@/lib/utils';

type ItemIconProps = {
  item: Pick<
    ItemDefinition,
    'name' | 'texturePath' | 'iconTint' | 'iconRotationDeg' | 'iconScale' | 'compactIconScale'
  >;
  alt?: string;
  className?: string;
  compact?: boolean;
  draggable?: boolean;
  style?: CSSProperties;
  tintOverride?: string | null;
};

function getItemIconTransform(item: ItemIconProps['item'], compact: boolean) {
  const rotationDeg = item.iconRotationDeg ?? 0;
  const scale = compact ? (item.compactIconScale ?? item.iconScale ?? 1) : (item.iconScale ?? 1);
  return `rotate(${rotationDeg}deg) scale(${scale})`;
}

function getMaskStyles(texturePath: string, tint: string, transform: string): CSSProperties {
  return {
    backgroundColor: tint,
    WebkitMaskImage: `url(${texturePath})`,
    maskImage: `url(${texturePath})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    mixBlendMode: 'multiply',
    transform,
    transformOrigin: 'center center',
  };
}

export function ItemIcon({
  item,
  alt,
  className,
  compact = false,
  draggable = false,
  style,
  tintOverride,
}: ItemIconProps) {
  const transform = getItemIconTransform(item, compact);
  const tint = tintOverride ?? item.iconTint ?? null;
  const imageClassName = 'pixelated absolute inset-0 h-full w-full object-contain';

  if (tint) {
    return (
      <span className={cn('relative block isolate', className)} style={style}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.texturePath}
          alt={alt ?? item.name}
          draggable={draggable}
          className={imageClassName}
          style={{
            transform,
            transformOrigin: 'center center',
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 pixelated"
          style={getMaskStyles(item.texturePath, tint, transform)}
        />
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={item.texturePath}
      alt={alt ?? item.name}
      draggable={draggable}
      className={cn('pixelated h-full w-full object-contain', className)}
      style={{
        ...style,
        transform,
        transformOrigin: 'center center',
      }}
    />
  );
}
