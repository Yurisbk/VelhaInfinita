import mongoose, { Document, Schema } from 'mongoose';

export const GAME_MODES = ['local', 'cpu', 'online', 'quickmatch', 'ranked'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'] as const;

export type GameMode = (typeof GAME_MODES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface IGameRecord extends Document {
  mode: GameMode;
  winner: 'X' | 'O' | 'none';
  moves: number[];
  durationSeconds: number;
  /** true when the game ended because a player left */
  abandoned?: boolean;
  difficulty?: Difficulty;
  /** CPU mode only: whether the human beat the CPU */
  humanWon?: boolean;
  players?: string[];
  createdAt: Date;
}

const gameRecordSchema = new Schema<IGameRecord>(
  {
    mode: { type: String, enum: GAME_MODES, required: true },
    winner: { type: String, enum: ['X', 'O', 'none'], required: true },
    moves: { type: [Number], default: [] },
    durationSeconds: { type: Number, required: true },
    abandoned: { type: Boolean, default: false },
    difficulty: { type: String, enum: DIFFICULTIES },
    humanWon: { type: Boolean },
    players: { type: [String] },
  },
  { timestamps: true },
);

export const GameRecord = mongoose.model<IGameRecord>('GameRecord', gameRecordSchema);
