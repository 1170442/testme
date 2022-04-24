const axios = require('axios');
const { v1: uuidv1, v4: uuidv4 } = require('uuid');
const _ = require("lodash");
const Utils = require('../../utils/utils');
const Constants = require('../../utils/constants');
const Dynamo = require('../../utils/dynamo_operations');
const RISK_ORCHESTRATOR_TABLE = process.env.RISK_ORCHESTRATOR_TABLE;
const PRODUCT_API_URL = process.env.PRODUCT_API_URL;
const MODULE_NAME = 'risk_eval';

module.exports.getAssessRisk = async function (req, res) {
    try {
        let status = 'in_progress';
        let risk_eval_res = await Dynamo.getData(RISK_ORCHESTRATOR_TABLE, '_id', req.params.id);

        const filtered_services = risk_eval_res.product.services.filter((svc) => svc.modules.includes(MODULE_NAME));
        const progress_state = filtered_services.every((service) => (typeof service.status !== 'undefined' || service.status === Constants.COMPLETED))

        if (progress_state) {
            status = Constants.COMPLETED;
        }

        risk_eval_res.status = status;
        risk_eval_res.risk_scoring = { ...risk_eval_res.risk_scoring.score };
        risk_eval_res.risk_pricing = { ...risk_eval_res.risk_pricing.pricing };
        risk_eval_res = _.omit(risk_eval_res, ['kyc', 'product.parties', 'product.can_select_insurer', 'product.quote_config', 'product.services', 'credit_rating', 'asset_validation', 'coverage_validation']);
        res.status(202).json(risk_eval_res);
    }
    catch (err) {
        console.log("Error: ", err);
        res.status(400).json({ err });
    }
};

module.exports.postAssessRisk = async function (req, res) {
    const _id = uuidv4();
    let risk_eval = req.body;
    risk_eval._id = _id;

    if (typeof risk_eval.product === 'undefined') {
        res.status(400).json({ Error: 'Product component is missing!' })
        return;
    }

    if (typeof risk_eval.product.product_id === 'undefined') {
        res.status(400).json({ Error: 'ProductId is missing!' })
        return;
    }

    if(risk_eval.coverage instanceof Array){
        risk_eval.coverage.forEach(cover => cover.id = uuidv4())
    }
    else{
        console.log("== Note: Coverage is not an Array!")
    }

    if(risk_eval.insured_risk instanceof Array){
        risk_eval.insured_risk.forEach(insured_risk => insured_risk.id = uuidv4())
    }
    else{
        console.log("== Note: Insured Risk is not an Array!")
    }

    try {
        const response = await axios.get(PRODUCT_API_URL + risk_eval.product.product_id);
        console.log(`== Product API Response: ${response}`);
        risk_eval.product = response.data;
        risk_eval.created_by = risk_eval.customer.customer_id;
        risk_eval.created_time = new Date().toISOString();
    } catch (error) {
        console.error(error);
    }

    try {
        console.log("== Orchestrator DB Params == : ", risk_eval);
        await Dynamo.putData(RISK_ORCHESTRATOR_TABLE, risk_eval);
        await Utils.publishSNS(risk_eval, Constants.RISK_EVAL_CREATED);
        res.json({ _id });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not create!" });
    }
}