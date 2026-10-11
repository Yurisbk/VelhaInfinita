"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = metricsMiddleware;
const metrics_1 = require("../utils/metrics");
function metricsMiddleware(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const durationSec = (Date.now() - start) / 1000;
        // Use the matched route pattern (e.g. /api/player/:id) so the label set stays
        // bounded; unmatched paths are bucketed together instead of one label per URL.
        const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
        const labels = {
            method: req.method,
            route,
            status_code: String(res.statusCode),
        };
        metrics_1.httpRequestDuration.observe(labels, durationSec);
        metrics_1.httpRequestsTotal.inc(labels);
    });
    next();
}
//# sourceMappingURL=metricsMiddleware.js.map