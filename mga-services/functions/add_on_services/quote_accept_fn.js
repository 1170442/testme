const QUOTE_SUBMIT_TABLE = process.env.QUOTE_SUBMIT_TABLE;
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');
const _ = require("lodash");

module.exports.accept = async (event) => {
    let quote_request = {};

    const {quote_accept_payload, quote_payload, quote} = JSON.parse(event.Records[0].Sns.Message);;
    quote_request = quote_payload.quote_request;
    quote_request.quote_request_id = quote.quote_request_id;
    const quote_mod = _.omit(quote, ['quote_request_id']);
    quote_mod.status = 'accepted';
    quote_request.quotes.push(quote_mod);
    quote_request.service_name = 'quote_request';

    console.log("== Quote Accepted: ", quote_mod);

    try {
        await Dynamo.putData(QUOTE_SUBMIT_TABLE, quote_request);
        await Utils.publishSNS(quote_request, Constants.QUOTE_ACCEPT_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in Quote Accept while publishing: ", err)
    }
}