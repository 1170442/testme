const express = require("express");
const serverless = require("serverless-http");
const app = express();
const RiskEval = require('./risk_eval/risk_api');
const Quote = require('./quote/quote_api');

app.use(express.json());

//Risk Evaluation
app.get("/assess_risk/:id", RiskEval.getAssessRisk);

app.post("/assess_risk", RiskEval.postAssessRisk);

//Quotes
app.get("/quote/:quote_request_id", Quote.getQuote);

app.post("/quote/request", Quote.requestQuote);

app.post("/quote/submit", Quote.submitQuote);

app.post("/quote/reject", Quote.rejectQuote);

app.post("/quote/accept", Quote.acceptQuote);

app.use((req, res, next) => {
    return res.status(404).json({
        error: "Path Not Found",
        path: req.url
    });
});

module.exports.core_api = serverless(app);