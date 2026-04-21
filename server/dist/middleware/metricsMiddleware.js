"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = metricsMiddleware;
const metrics_1 = require("../utils/metrics");
function metricsMiddleware(req, res, next) {
    const start = Date.now();
    const route = req.route?.path ?? req.path;
    res.on('finish', () => {
        const durationSec = (Date.now() - start) / 1000;
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