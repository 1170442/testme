const KYC_TABLE = process.env.KYC_TABLE;
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');

module.exports.kyc = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const customers = Utils.fetchParties(message.parties, Constants.PARTY.INSURANCE_INSURED);
    let kyc_payload;
    if(customers.length > 0){
        kyc_payload = customers[0];
        kyc_payload.status = Constants.COMPLETED;
    }
    else{
        console.log("== KYC : Customer's length is zero!");
    }

    if(!message.service.is_external){
        kyc_payload._id = message._id;
        message.kyc = kyc_payload;
    }
    else{
        console.log("== KYC external: Feature not supported right now")
    }

    message.kyc.service_name = message.service.name;

    console.log("== KYC: ", message);

    try {
        await Dynamo.putData(KYC_TABLE, message);
        await Utils.publishSNS(message.kyc, Constants.KYC_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in KYC: ", err)
    }
}