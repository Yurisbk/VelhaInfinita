"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const GameRecord_1 = require("../models/GameRecord");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    try {
        const [totalGames, byMode, byWinner] = await Promise.all([
            GameRecord_1.GameRecord.countDocuments(),
            GameRecord_1.GameRecord.aggregate([
                { $group: { _id: '$mode', count: { $sum: 1 } } },
            ]),
            GameRecord_1.GameRecord.aggregate([
                { $group: { _id: { mode: '$mode', winner: '$winner' }, count: { $sum: 1 } } },
            ]),
        ]);
        res.json({ totalGames, byMode, byWinner });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Erro ao buscar estatísticas.' });
    }
});
exports.default = router;
//# sourceMappingURL=stats.js.map