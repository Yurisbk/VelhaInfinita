import { GameState } from '../utils/gameLogic';
import Cell from './Cell';

interface BoardProps {
  state: GameState;
  onMove: (index: number) => void;
  disabled?: boolean;
  /** Indices that are part of the winning combination */
  winningCells?: number[];
}

export default function Board({
  state,
  onMove,
  disabled = false,
  winningCells = [],
}: BoardProps) {
  return (
    <div
      className="grid gap-2 sm:gap-3 w-full max-w-[min(90vw,360px)] mx-auto"
      style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
      data-testid="board"
    >
      {state.board.map((cell, i) => (
        <Cell
          key={i}
          value={cell}
          index={i}
          isFading={state.fadingCell === i}
          isWinning={winningCells.includes(i)}
          onClick={onMove}
          disabled={disabled || state.winner !== null}
        />
      ))}
    </div>
  );
}
