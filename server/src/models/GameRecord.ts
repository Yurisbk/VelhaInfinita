import mongoose, { Document, Schema } from 'mongoose';

export type GameMode = 'local' | 'online' | 'cpu';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface IGameRecord extends Document {
  mode: GameMode;
  winner: 'X' | 'O' | 'none';
  moves: number[];
  durationSeconds: number;
  difficulty?: Difficulty;
  players?: string[];
  createdAt: Date;
}

const gameRecordSchema = new Schema<IGameRecord>(
  {
    mode: { type: String, enum: ['local', 'online', 'cpu'], required: true },
    winner: { type: String, enum: ['X', 'O', 'none'], required: true },
    moves: { type: [Number], default: [] },
    durationSeconds: { type: Number, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
    players: { type: [String] },
  },
  { timestamps: true },
);

export const GameRecord = mongoose.model<IGameRecord>('GameRecord', gameRecordSchema);
