import type { Metadata } from 'next';
import { ArenaDashboard } from './arena-dashboard';

export const metadata: Metadata = {
  title: 'Arena | CodeArena 2.0',
  description: 'Follow the campus coding arena, build practice XP, and discover your next achievement.',
};

export default function ArenaPage() {
  return (
    <div className="flex-1 animate-fade-in">
      <ArenaDashboard />
    </div>
  );
}
