const CREDIT_RATING_TABLE = process.env.CREDIT_RATING_TABLE;
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');

module.exports.credit_rating = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const customers = Utils.fetchParties(message.parties, Constants.PARTY.INSURANCE_INSURED);
    let credit_rating_payload;
    if(customers.length > 0){
        credit_rating_payload = customers[0];
        credit_rating_payload.status = Constants.COMPLETED;
    }
    else{
        console.log("== Credit Rating : Customer's length is zero!");
    }

    if(!message.service.is_external){
        credit_rating_payload._id = message._id;
        message.credit_rating = credit_rating_payload;
    }
    else{
        console.log("== Credit Rating external: Feature not supported right now")
    }

    message.credit_rating.service_name = message.service.name;

    console.log("==== Credit Rating: ", message);

    try {
        await Dynamo.putData(CREDIT_RATING_TABLE, message);
        await Utils.publishSNS(message.credit_rating, Constants.CREDIT_RATING_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in Credit Rating: ", err)
    }
}