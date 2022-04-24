// const URL = "http://localhost:4000"
const URL = "http://mgageodataapi.marshlabs.dev:4000"
const axios = require('axios')
const _ = require('lodash');
const INLAND_FLOOD = 'inland_flood';
const STORM_SURGE = 'storm_surge';
const TSUNAMI = 'tsunami'
const GREAT_LAKES = 'great_lakes';
const COASTAL_EROSION = 'coastal_erosion'

exports.rate_per_1000_dollars = async(geo_output, ph_output)=>{
    console.log(`step: premium : rate_per_1000_dollars`)
    const peril_keys= Object.keys(geo_output)
    let value = 0; 
    peril_keys.forEach(key=>{
        value = value + ph_output[key]['rate_by_peril']
    })
    return {
        rate_per_1000_dollars : value
    }
}

exports.rate_weights_by_coverage = (geo_output, ph_output, pre_output)=>{
    console.log(`step: premium : rate_weights_by_coverage`)
    const peril_keys= Object.keys(geo_output)
    pre_output['rate_weights_by_coverage'] = {}
    peril_keys.forEach(key=>{
        if(ph_output[key]['rate_by_peril']==0){
            pre_output['rate_weights_by_coverage'] 
            pre_output['rate_weights_by_coverage'][key] = 0
        }else{
            pre_output['rate_weights_by_coverage'][key] = (ph_output[key]['rate_by_peril']/pre_output.rate_per_1000_dollars)*100;
        }
    })
}

exports.weighted_deductable_itv_factor = (ph_output, pre_output)=>{
    console.log(`step: premium : weighted_deductable_itv_factor`)
    const result = (ph_output[INLAND_FLOOD]['final_deductible_and_itv'] * (pre_output['rate_weights_by_coverage'][INLAND_FLOOD]/100)) +
                    (ph_output[STORM_SURGE]['final_deductible_and_itv'] * (pre_output['rate_weights_by_coverage'][STORM_SURGE]/100)) + 
                    (ph_output[COASTAL_EROSION]['final_deductible_and_itv'] * (pre_output['rate_weights_by_coverage'][COASTAL_EROSION]/100))
    pre_output['weighted_deductable_itv_factor'] = result;
}

//TODO
exports.max_min_rate_1000_dollars = (ph_output, pre_output)=>{
    pre_output['min_rate_for_1000_dollars'] = 0;
    pre_output['max_rate_for_1000_dollars'] = pre_output['weighted_deductable_itv_factor'] * ph_output['inland_flood']['crs_discount_percent'];
}


exports.final_rate_per_1000_dollars = (pre_output)=>{
    pre_output['final_rate_per_1000_dollars'] = Math.min(Math.max(pre_output['rate_per_1000_dollars'],pre_output['min_rate_for_1000_dollars']), pre_output['max_rate_for_1000_dollars'])
}

exports.coverage_value_in_thousands = (property, pre_output)=>{
    pre_output['coverage_value_in_thousands'] = property.coverage_a_value/1000;
}

exports.initial_premium_without_fees = (pre_output)=>{
    pre_output['initial_premium_without_fees'] = pre_output['coverage_value_in_thousands'] * pre_output['final_rate_per_1000_dollars']
}

exports.prior_claims_premium = (property, pre_output)=>{
    pre_output['prior_claims_premium'] = property['prior_claims'] * pre_output['coverage_value_in_thousands'] * pre_output['weighted_deductable_itv_factor'] * Math.max(property.prior_claims-1,0)
}

exports.premiums_exluding_fees_and_expanse_constant = (pre_output)=>{
    pre_output['premiums_exluding_fees_and_expanse_constant'] = pre_output['initial_premium_without_fees'] + pre_output['prior_claims_premium'] 
}

//CONSTANT
exports.expense_loss_constants = (pre_output)=>{
    pre_output['expense_constant'] = 62.99;
    pre_output['loss_constant'] = 130;
}

exports.premium_without_fees = (pre_output)=>{
    pre_output['premium_without_fees'] = pre_output['premiums_exluding_fees_and_expanse_constant'] + pre_output['expense_constant'] + pre_output['loss_constant'] 
}