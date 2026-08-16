'use client';

/**
 * THE GAME.
 *
 * The loop is a module singleton, so navigating here from the founding screen
 * finds the game already created. Arriving with no game — a refresh, or a
 * direct link — sends the player back to the title rather than showing an
 * empty shell.
 */

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { GameShell } from '@/components/game/GameShell';
import { useGameStore } from '@/store/gameStore';

export default function PlayPage() {
  const router = useRouter();
  const hasGame = useGameStore((s) => s.snapshot !== null);

  useEffect(() => {
    if (!hasGame) router.replace('/');
  }, [hasGame, router]);

  if (!hasGame) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-900">
        <p className="text-body text-content-muted">
          No game in progress. Returning to the title…
        </p>
      </main>
    );
  }

  return <GameShell />;
}
