import {
  Circle,
  Eraser,
  Hand,
  type LucideIcon,
  PaintBucket,
  Pencil,
  Pipette,
  Slash,
  Square,
} from 'lucide-react';
import type { TKey } from '../../shared/i18n';
import type { Tool } from './store';

export interface ToolDef {
  id: Tool;
  icon: LucideIcon;
  label: TKey;
  /** Клавіша (KeyboardEvent.code) — працює однаково на англійській та українській розкладці */
  code: string;
  key: string;
}

export const TOOLS: ToolDef[] = [
  { id: 'pencil', icon: Pencil, label: 'tool.pencil', code: 'KeyB', key: 'B' },
  { id: 'eraser', icon: Eraser, label: 'tool.eraser', code: 'KeyE', key: 'E' },
  { id: 'fill', icon: PaintBucket, label: 'tool.fill', code: 'KeyG', key: 'G' },
  { id: 'picker', icon: Pipette, label: 'tool.picker', code: 'KeyI', key: 'I' },
  { id: 'line', icon: Slash, label: 'tool.line', code: 'KeyL', key: 'L' },
  { id: 'rect', icon: Square, label: 'tool.rect', code: 'KeyU', key: 'U' },
  { id: 'ellipse', icon: Circle, label: 'tool.ellipse', code: 'KeyO', key: 'O' },
  { id: 'hand', icon: Hand, label: 'tool.hand', code: 'KeyH', key: 'H' },
];
