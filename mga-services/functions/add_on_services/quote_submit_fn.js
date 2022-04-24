const QUOTE_SUBMIT_TABLE = process.env.QUOTE_SUBMIT_TABLE;
const QUOTE_ORCHESTRATOR_TABLE = process.env.QUOTE_ORCHESTRATOR_TABLE;
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');
const _ = require("lodash");

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

module.exports.submit = async (event) => {
    let quote_request = {};

    const {quote_payload, quote, message} = JSON.parse(event.Records[0].Sns.Message);

    if(typeof message !== 'undefined'){
        const broker = Utils.fetchParties(message.parties, Constants.PARTY.INSURANCE_BROKER);
        const customer = Utils.fetchParties(message.parties, Constants.PARTY.INSURANCE_INSURED);
        const carriers = Utils.fetchParties(message.parties, Constants.PARTY.INSURANCE_CARRIER);
        
        let product;
        const orch_payload = await Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', message.quote_request_id);
        if(orch_payload !== null){
            console.log(`== ORCH Payload: ${JSON.stringify(orch_payload)}`);
            product = orch_payload.product;
        }
        else{
            console.log(`Orchestrator payload found null`);
        }
        console.log(`== Message: ${JSON.stringify(message)}`);

        
        let carrier_ids = [];
        carriers.forEach(carrier => {
            carrier_ids.push(carrier.id)
        })

        let date = new Date();

        quote.issue_date = new Date().toISOString().split('T')[0];
        quote.valid_from = new Date().toISOString().split('T')[0];
        quote.valid_to = date.addDays(15).toISOString().split('T')[0];
        quote.issued_by = carrier_ids.join(', ');
        quote.issued_for = (customer.length>0)?customer[0].customer_id:'NA';
        quote.for_product = product.product_id;
        quote.term_type = "365 days"
        quote.approximate_start_date = date.addDays(5).toISOString().split('T')[0];
        quote.broker_id = (broker.length>0)?broker[0].id:'NA';
        quote.insured_risk_id = message.insured_risk[0].id;
        quote.coverage_id = message.coverage[0].id;
        quote.coverage_layer = "100%";
        quote.description = product.description;
        quote.incidents_covered = product.incidents_covered;
        quote.clauses = product.clauses;
        quote.terms = product.terms;
        quote.additional_details = product.additional_details;
        quote.deductible_amount = message.coverage[0].coverage_deductable
        quote.premium_amount = message.risk_pricing.pricing.subtotal
    }

    quote_request = quote_payload.quote_request;
    quote_request.quote_request_id = quote.quote_request_id;
    const quote_mod = _.omit(quote, ['quote_request_id']);
    quote_request.quotes.push(quote_mod);
    quote_request.service_name = 'quote_request';
    quote_request.quote_id = quote.quote_id;

    console.log("== Quote Submitted: ", quote_mod);

    try {
        await Dynamo.putData(QUOTE_SUBMIT_TABLE, quote_request);
        await Utils.publishSNS(quote_request, Constants.QUOTE_SUBMIT_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in Quote Submission while publishing: ", err)
    }
}