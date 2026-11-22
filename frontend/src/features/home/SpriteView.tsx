import { useMemo } from 'react';
import { PixelImage } from '../../shared/ui/PixelImage';
import { compositeFrame, docFromPixels } from '../editor/model';
import { type Sprite, spriteToPixels } from './sprites';

export function SpriteView({ sprite, className, label }: { sprite: Sprite; className?: string; label?: string }) {
  const rgba = useMemo(
    () => compositeFrame(docFromPixels(sprite.width, sprite.height, spriteToPixels(sprite)), 0),
    [sprite],
  );
  return <PixelImage rgba={rgba} width={sprite.width} height={sprite.height} className={className} label={label} />;
}
