const ASSET_VALIDATION_TABLE = process.env.ASSET_VALIDATION_TABLE;
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');

module.exports.asset_validation = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const asset_validation_payload = message.insured_risk[0];
    asset_validation_payload.status = Constants.COMPLETED;
    
    if(!message.service.is_external){
        asset_validation_payload._id = message._id;
        message.asset_validation = asset_validation_payload;
    }
    else{
        console.log("== Asset Validation external: Feature not supported right now")
    }

    message.asset_validation.service_name = message.service.name;

    console.log("== Asset Validation: ", message);

    try {
        await Dynamo.putData(ASSET_VALIDATION_TABLE, message)
        await Utils.publishSNS(message.asset_validation, Constants.ASSET_VALIDATION_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in Asset Validation: ", err)
    }
}