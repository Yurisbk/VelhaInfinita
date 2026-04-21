import mongoose, { Schema, Document } from 'mongoose';

export interface IPlayer extends Document {
  playerId: string;
  name: string;
  elo: number;
  rankedWins: number;
  rankedLosses: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>(
  {
    playerId: { type: String, required: true, unique: true, index: true },
    name:     { type: String, default: 'Jogador' },
    elo:      { type: Number, default: 1000 },
    rankedWins:   { type: Number, default: 0 },
    rankedLosses: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Player = mongoose.model<IPlayer>('Player', PlayerSchema);
