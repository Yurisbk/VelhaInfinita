import { PlayerStats } from '../services/api';

interface LeaderboardProps {
  players: PlayerStats[] | null;
  /** Highlights this name (best effort — names are not unique) */
  highlightName?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ players, highlightName }: LeaderboardProps) {
  if (players === null) {
    return <p className="text-white/30 text-sm text-center py-2">Carregando ranking…</p>;
  }
  if (players.length === 0) {
    return (
      <p className="text-white/40 text-sm text-center py-2">
        Ninguém no ranking ainda — seja o primeiro!
      </p>
    );
  }
  return (
    <ol className="space-y-1">
      {players.map((p, i) => (
        <li
          key={`${p.name}-${i}`}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            highlightName && p.name === highlightName ? 'bg-yellow-500/15' : 'bg-white/5'
          }`}
        >
          <span className="w-6 text-center shrink-0">{MEDALS[i] ?? `${i + 1}`}</span>
          <span className="flex-1 min-w-0 truncate font-semibold">{p.name}</span>
          <span className="text-white/40 text-xs shrink-0 tabular-nums">
            {p.rankedWins}V · {p.rankedLosses}D
          </span>
          <span className="w-12 text-right font-black text-yellow-400 shrink-0 tabular-nums">{p.elo}</span>
        </li>
      ))}
    </ol>
  );
}
