const FLOOD_RISK_PRICING_TABLE = process.env.FLOOD_RISK_PRICING_TABLE;
const Utils = require('../../utils/utils');
const Constants = require('../../utils/constants');
const flood = require('./risk_pricing');
const Dynamo = require('../../utils/dynamo_operations');

module.exports.risk_pricing = async (event) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    let flood_risk_price;
    let publish_flood_risk_pricing

    try {
        console.log("== Risk Pricing message: ", message);

        if(!message.service.is_external){
            flood_risk_price = await flood.risk_pricing(message.risk_scoring);
            flood_risk_price._id = message._id;
            flood_risk_price.status = Constants.COMPLETED

            publish_flood_risk_pricing = preparePublishPayload(flood_risk_price, message);
            console.log("== Flood Risk Pricing: ", publish_flood_risk_pricing);
            message.risk_pricing = publish_flood_risk_pricing;

        }
        else{
            console.log("== Risk Pricing external: Feature not supported right now")
        }
        
        message.risk_pricing.service_name = message.service.name.replace('flood_', '');
    } catch (err) {
        console.log("== Errored in Risk Pricing: ", err)
    }

    try {
        await Dynamo.putData(FLOOD_RISK_PRICING_TABLE, message);
        await Utils.publishSNS(publish_flood_risk_pricing, Constants.RISK_PRICING_COMPLETED);
    }
    catch (err) {
        console.log("== Errored in saving to DB of Risk Pricing: ", err)
    }

    function preparePublishPayload(payload, message) {
        let publishPayload = { ...payload };
        publishPayload.pricing = {
            "prior_claims_premium": message.coverage[0].previous_claims,
            "coverage_value": message.coverage[0].coverage_value,
            "coverage_limit": message.coverage[0].coverage_limit,
            "coverage_deductable": message.coverage[0].coverage_deductable,
            "reserve_fund": message.risk_scoring.property_info.reserve_fund,
            "primary_residence_indicator": message.risk_scoring.property_info.primary_residence_indicator,
            "icc_premium": publishPayload.premium.icc_premium,
            "icc_premium_with_crs_discount": publishPayload.premium.icc_premium_with_crs_discount,
            "subtotal": publishPayload.premium.subtotal,
            "subtotal_with_reserve": publishPayload.premium.subtotal_with_reserve,
            "hfiaa_surcharge": publishPayload.premium.hfiaa_surcharge,
            "federal_policy_fee": publishPayload.premium.federal_policy_fee,
            "probation_surcharge": publishPayload.premium.probation_surcharge,
            "premium_with_fees": publishPayload.premium.premium_with_fees
        };
        publishPayload.status = Constants.COMPLETED;
        return publishPayload;
    }
}