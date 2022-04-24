// const URL = "http://localhost:4000"
const URL = "http://mgageodataapi.marshlabs.dev:4000"
const axios = require('axios')
const _ = require('lodash');
const INLAND_FLOOD = 'inland_flood';
const STORM_SURGE = 'storm_surge';
const TSUNAMI = 'tsunami'
const GREAT_LAKES = 'great_lakes';
const COASTAL_EROSION = 'coastal_erosion'

//CONSTANT
exports.hfiaa_surcharge = (property,pre_output)=>{
    if(property.primary_residence_indicator == "Yes"){
        pre_output['hfiaa_surcharge'] = 50;
    } else{
        pre_output['hfiaa_surcharge'] = 250;
    }
}

//CONSTANT
exports.federal_policy_fee = (pre_output,property)=>{
    pre_output['federal_policy_fee'] = property.federal_policy_fee;
    pre_output['probation_surcharge'] = property.probation_surcharge;
}

exports.premium_with_fees = (pre_output)=>{
    pre_output['premium_with_fees'] = pre_output['subtotal_with_reserve'] + pre_output['probation_surcharge'] + pre_output['hfiaa_surcharge'] + pre_output['federal_policy_fee'];
}