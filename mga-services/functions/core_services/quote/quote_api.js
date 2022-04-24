const axios = require('axios');
const QUOTE_ORCHESTRATOR_TABLE = process.env.QUOTE_ORCHESTRATOR_TABLE;
const { v1: uuidv1, v4: uuidv4 } = require('uuid');
const _ = require("lodash");
const Utils = require('../../utils/utils');
const Constants = require('../../utils/constants');
const Dynamo = require('../../utils/dynamo_operations');
const PRODUCT_API_URL = process.env.PRODUCT_API_URL;
const MODULE_NAME = 'quote';

module.exports.getQuote = async function (req, res) {
    let status = 'in_progress';
    const quote_request_id = req.params.quote_request_id;

    if(typeof quote_request_id === 'undefined'){
        return res.status(400).json({ Error: 'quote_request_id is missing!' }); 
    }

    try{
        let quote_payload = await Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', quote_request_id);
        if(quote_payload !== null){
            const filtered_services = quote_payload.product.services.filter((svc) => svc.modules.includes(MODULE_NAME));
            const progress_state = filtered_services.every((service) => (typeof service.status !== 'undefined' || service.status === Constants.COMPLETED))
    
            if (progress_state) {
                status = Constants.COMPLETED;
            }

            quote_payload.status = status;
            quote_payload.quotes = quote_payload.quote_request.quotes;
            quote_payload = _.omit(quote_payload, ['_id', 'kyc', 'product.parties', 'product.can_select_insurer', 'product.quote_config', 'product.services', 'credit_rating', 'asset_validation', 'coverage_validation', 'quote_request', 'risk_scoring', 'risk_pricing']);
            return res.status(202).json(quote_payload);
        }
        else{
            return res.status(400).json({ Error: `Quote for the mentioned quote_request_id: ${quote_reject_payload.quote_request_id} is not present!`}); 
        }
    }
    catch(err){
        return res.status(500).json({Error: "Errored in Quote while fetching: " + err})
    }
}

module.exports.requestQuote = async function (req, res) {
    const _id = uuidv4();
    let quote_eval = req.body;
    quote_eval.quote_request_id = _id;
    quote_eval._id = _id;

    if (typeof quote_eval.product === 'undefined') {
        res.status(400).json({ Error: 'Product component is missing!' })
        return;
    }

    if (typeof quote_eval.product.product_id === 'undefined') {
        res.status(400).json({ Error: 'ProductId is missing!' })
        return;
    }

    if(quote_eval.coverage instanceof Array){
        quote_eval.coverage.forEach(cover => cover.id = uuidv4())
    }
    else{
        console.log("== Note: Coverage is not an Array!")
    }

    if(quote_eval.insured_risk instanceof Array){
        quote_eval.insured_risk.forEach(insured_risk => insured_risk.id = uuidv4())
    }
    else{
        console.log("== Note: Insured Risk is not an Array!")
    }

    try {
        let customer_id;
        const customer = Utils.fetchParties(quote_eval.parties, Constants.PARTY.INSURANCE_INSURED);
        if(customer.length > 0){
            customer_id = customer.customer_id;
        }
        else{
            console.log("== Quote API : Customer's length is zero!");
        }
        const response = await axios.get(PRODUCT_API_URL + quote_eval.product.product_id);
        console.log(`== Product API Response: ${response}`);
        quote_eval.product = response.data;
        quote_eval.created_by = customer_id;
        quote_eval.created_time = new Date().toISOString();
    } catch (error) {
        console.error(error);
    }

    try {
        console.log("== Orchestrator DB Params == : ", quote_eval);
        await Dynamo.putData(QUOTE_ORCHESTRATOR_TABLE, quote_eval);
        await Utils.publishSNS(quote_eval, Constants.QUOTE_CREATED);
        res.json({ "quote_request_id": _id });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Could not create!" });
    }
}

module.exports.submitQuote = async function (req, res) {
    let quote_payload;
    const id = uuidv4();
    const quote = req.body;
    quote.quote_request_id = req.body.quote_request_id;
    quote.quote_id = id;
    quote.status = 'new'

    if(typeof quote.quote_request_id === 'undefined'){
        res.status(400).json({ Error: 'quote_request_id is missing!' })
        return; 
    }

    try{
        quote_payload = await Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', quote.quote_request_id);
        if(quote_payload !== null){
            await Utils.publishSNS({quote_payload, quote}, Constants.QUOTE_SUBMIT_START);
            return res.status(202).json({'quote_id': id});
        }
        else{
            res.status(400).json({ Error: `Quote for the mentioned quote_request_id: ${quote.quote_request_id} is not present!`})
            return; 
        }
    }
    catch(err){
        res.status(500).json({Error: "Errored in Quote Submission while fetching: " + err})
    }
}

module.exports.rejectQuote = async function (req, res) {
    let quote_payload;
    let quote;
    const quote_reject_payload = {};
    quote_reject_payload.quote_request_id = req.body.quote_request_id;
    quote_reject_payload.quote_id = req.body.quote_id;

    if(typeof quote_reject_payload.quote_request_id === 'undefined' || typeof quote_reject_payload.quote_id === 'undefined'){
        res.status(400).json({ Error: 'quote_request_id or quote_id is missing!' })
        return; 
    }

    try{
        quote_payload = await Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', quote_reject_payload.quote_request_id);
        if(quote_payload !== null){
            quote_payload.quote_request.quotes.forEach(_quote => {
                if(_quote.quote_id === quote_reject_payload.quote_id){
                    _quote.status = 'rejected';
                    quote = _quote;
                }
            })
            await Dynamo.putData(QUOTE_ORCHESTRATOR_TABLE, quote_payload);

            if(typeof quote === 'undefined'){
                res.status(400).json({ Error: `Quote submission for the mentioned quote_id: ${quote_reject_payload.quote_id} is not present!`})
                return;
            }
            else{
                await Utils.publishSNS({quote_reject_payload, quote_payload, quote}, Constants.QUOTE_REJECT_START);
                return res.status(202).json({'status': `quote with quote_id: ${quote_reject_payload.quote_id} is rejected`});
            }
        }
        else{
            res.status(400).json({ Error: `Quote for the mentioned quote_request_id: ${quote_reject_payload.quote_request_id} is not present!`})
            return; 
        }
    }
    catch(err){
        res.status(500).json({Error: "Errored in Quote Reject while fetching: " + err})
    }
}

module.exports.acceptQuote = async function (req, res) {
    let quote_payload;
    let quote;
    const quote_accept_payload = {};
    quote_accept_payload.quote_request_id = req.body.quote_request_id;
    quote_accept_payload.quote_id = req.body.quote_id;

    if(typeof quote_accept_payload.quote_request_id === 'undefined' || typeof quote_accept_payload.quote_id === 'undefined'){
        res.status(400).json({ Error: 'quote_request_id or quote_id is missing!' })
        return; 
    }

    try{
        quote_payload = await Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', quote_accept_payload.quote_request_id);
        if(quote_payload !== null){
            quote_payload.quote_request.quotes.forEach(_quote => {
                if(_quote.quote_id === quote_accept_payload.quote_id){
                    _quote.status = 'accepted';
                    quote = _quote;
                }
            })
            await Dynamo.putData(QUOTE_ORCHESTRATOR_TABLE, quote_payload);
 
            if(typeof quote === 'undefined'){
                res.status(400).json({ Error: `Quote submission for the mentioned quote_id: ${quote_accept_payload.quote_id} is not present!`})
                return;
            }
            else{
                await Utils.publishSNS({quote_accept_payload, quote_payload, quote}, Constants.QUOTE_ACCEPT_START);
                return res.status(202).json({'status': `quote with quote_id: ${quote_accept_payload.quote_id} is accepted`});
            }
        }
        else{
            res.status(400).json({ Error: `Quote for the mentioned quote_request_id: ${quote_accept_payload.quote_request_id} is not present!`})
            return; 
        }
    }
    catch(err){
        res.status(500).json({Error: "Errored in Quote Accept while fetching: " + err})
    }
}
/**
 * =============TO BE DELETED - Work in progress comments================
 * Webhook
 *  success: ''
 *  publishing the event kyc completed
 *  http endpoint that receives payload and publishes the corresponding event
 * 
 * 
 
every req -> addendums
attachments to s3
 */

