const COVERAGE_VALIDATION_TABLE = process.env.COVERAGE_VALIDATION_TABLE;
const Utils = require('../utils/utils');
const Constants = require('../utils/constants');
const Dynamo = require('../utils/dynamo_operations');

module.exports.coverage_validation = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const coverage_validation_payload = message.coverage[0];
    coverage_validation_payload.status = Constants.COMPLETED;

    if(!message.service.is_external){
        coverage_validation_payload._id = message._id;
        message.coverage_validation = coverage_validation_payload;
    }
    else{
        console.log("== Coverage Validation external: Feature not supported right now")
    }

    message.coverage_validation.service_name = message.service.name;

    console.log("== Coverage Validation: ", message);

    try {
        await Dynamo.putData(COVERAGE_VALIDATION_TABLE, message);
        await Utils.publishSNS(message.coverage_validation, Constants.COVERAGE_VALIDATION_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in Coverage Validation: ", err)
    }
}