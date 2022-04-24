const FLOOD_RISK_SCORING_TABLE = process.env.FLOOD_RISK_SCORING_TABLE;
const Utils = require('../../utils/utils');
const Constants = require('../../utils/constants');
const flood = require('./risk_scoring');
const property = require('./request.json');
const Dynamo = require('../../utils/dynamo_operations');

module.exports.risk_scoring = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    let flood_risk_score;
    let publish_flood_risk;
    try {
        if(!message.service.is_external){
            message.asset_validation.name = message.service.name;
            console.log("== Property value: ", property);
            flood_risk_score = await flood.risk_scoring(property);
            console.log("== Flood risk score: ", flood_risk_score);
            flood_risk_score._id = message._id;
            flood_risk_score.status = Constants.COMPLETED;

            publish_flood_risk = preparePublishPayload(flood_risk_score);
            message.risk_scoring = publish_flood_risk;
        }
        else{
            console.log("== Risk Scoring external: Feature not supported right now")
        }
    
        message.risk_scoring.service_name = message.service.name.replace('flood_', '');    
    } catch (err) {
        console.log("== Errored in Risk Scoring: ", err)
    }

    try {
        await Dynamo.putData(FLOOD_RISK_SCORING_TABLE, message);
        await Utils.publishSNS(message.risk_scoring, Constants.RISK_SCORING_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in saving to DB of Risk Scoring: ", err)
    }

    function preparePublishPayload(payload) {
        let publishPayload = {};
        publishPayload.score = {};
        publishPayload._id = payload._id;
        publishPayload.geo_info = { ...payload.geo_info };
        publishPayload.peril_info = { ...payload.peril_info };
        publishPayload.property_info = { ...payload.property_info };
        Object.keys(publishPayload.peril_info).forEach(function (peril_key) {
            Object.keys(publishPayload.peril_info[peril_key]).forEach(function (key) {
                console.log('Parent Key: ' + peril_key + ' Subkey: ' + key + ', Value : ' + publishPayload.peril_info[peril_key][key]);
                if (key === 'rate_by_peril') {
                    publishPayload['score'][peril_key] = publishPayload.peril_info[peril_key][key];
                }
            })
        })
        publishPayload.score.rating_engine_name = "FEMA_V1.0";
        publishPayload.score.rating_engine_id = "FEMA34123";
        publishPayload.score.acturial_analysis = "";
        publishPayload.status = Constants.COMPLETED;
        return publishPayload;
    }
}