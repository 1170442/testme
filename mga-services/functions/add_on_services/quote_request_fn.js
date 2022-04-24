const axios = require('axios');
const { v1: uuidv1, v4: uuidv4 } = require('uuid');
const _ = require("lodash");
const QUOTE_REQUEST_TABLE = process.env.QUOTE_REQUEST_TABLE;
const QUOTE_ORCHESTRATOR_TABLE = process.env.QUOTE_ORCHESTRATOR_TABLE;
const CARRIER_API_URL = process.env.CARRIER_API_URL;
const QUOTE_SUBMIT_PAYLOAD = require('../utils/quote_submit_payload.json');
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');

module.exports.request = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    console.log(`== QUOTE MSG RECEIVED: ${JSON.stringify(message)}`);
    if(message.service.is_external){
        let product = {};
        const quote_payload = {
            "status": Constants.COMPLETED
        };
        
        const carriers = Utils.fetchParties(message.parties, Constants.PARTY.INSURANCE_CARRIER);

        if(carriers.length > 0){
            product['parties'] = [];
            carriers.forEach(carrier => {
                product['parties'].push(carrier);
            })
        }
        else{
            console.log("== Carrier : Carrier's length is zero!");

            const orch_payload = await Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', message.quote_request_id);

            if(orch_payload !== null){
                console.log(`== ORCH Payload: ${JSON.stringify(orch_payload)}`);
                product = orch_payload.product;
            }
            else{
                console.log(`Orchestrator payload found null`);
            }
        }
       
        quote_payload.quote_request_id = message.quote_request_id;
        quote_payload.quotes = [];
        message.quote_request = quote_payload;
        message.quote_request.service_name = message.service.name;

        if(typeof product.parties === 'undefined' || product.parties.length === 0){
            console.log(`== No carriers available`)
        }
        else{
            let quote_request_res = message;
            quote_request_res.risk_scoring = { ...quote_request_res.risk_scoring.score };
            quote_request_res.risk_pricing = { ...quote_request_res.risk_pricing.pricing };
            quote_request_res = _.omit(quote_request_res, ['_id', 'kyc', 'parties', 'product.parties', 'product.can_select_insurer', 'product.services', 'credit_rating', 'asset_validation', 'coverage_validation', 'quote_request', 'service'])
            for(carrier of product.parties){
                const res = await axios.get(CARRIER_API_URL + '/carrier/' + carrier.id);
                console.log(`== Carrier's Details API Response: ${res.data}`);
                const url = res.data.api.url;
                const response = await axios.post(url, quote_request_res);
                console.log(`== Carrier API Response: ${response}`);
            }
        }
    }
    else{
        const quote_payload = {}
        quote_payload.quote_request = {
            "status": Constants.COMPLETED
        };
        quote_payload.quote_request.quote_request_id = message.quote_request_id;
        quote_payload.quote_request.quotes = [];
        message.quote_request = quote_payload.quote_request;
        message.quote_request.service_name = message.service.name;

        const id = uuidv4();
        const quote = QUOTE_SUBMIT_PAYLOAD
        quote.quote_request_id = message.quote_request_id;
        quote.quote_id = id;
        quote.status = 'new'

        if(typeof quote.quote_request_id === 'undefined'){
            console.log({ Error: 'Submission failed: quote_request_id is missing!' })
            return; 
        }

        try{
            if(typeof quote_payload.quote_request.quote_request_id !== 'undefined'){
                await Utils.publishSNS({quote_payload, quote, message}, Constants.QUOTE_SUBMIT_START);
            }
            else{
                console.log({ Error: `Submission failed: Quote for the mentioned quote_request_id: ${quote_payload.quote_request.quote_request_id} is not present!`})
                return; 
            }
        }
        catch(err){
            console.log({Error: "Submission failed: Errored in Quote Submission while fetching: " + err})
        }
    }

    console.log("== Quote: ", message);

    try {
        await Dynamo.putData(QUOTE_REQUEST_TABLE, message);
        await Utils.publishSNS(message.quote_request, Constants.QUOTE_REQUEST_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in Quote Req: ", err)
    }
}