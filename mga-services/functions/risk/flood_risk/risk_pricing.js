const pre_functions = require('./premiumfactors')
const subtotal_functions = require('./subtotal')
const fees_functions = require('./premiumwithfees')


exports.risk_pricing = async(data)=>{
    const {geo_info, peril_info, property_info} = data;
    //Premium calculation
    let pre_output = {};
    const rate_per_1000_dollars = await pre_functions.rate_per_1000_dollars(geo_info, peril_info)
    pre_output= {...pre_output, ...rate_per_1000_dollars}
    pre_functions.rate_weights_by_coverage(geo_info, peril_info, pre_output)
    pre_functions.weighted_deductable_itv_factor(peril_info, pre_output)
    pre_functions.max_min_rate_1000_dollars(peril_info, pre_output)
    pre_functions.final_rate_per_1000_dollars(pre_output)
    pre_functions.coverage_value_in_thousands(property_info,pre_output)
    pre_functions.initial_premium_without_fees(pre_output)
    pre_functions.prior_claims_premium(property_info,pre_output)
    pre_functions.premiums_exluding_fees_and_expanse_constant(pre_output)
    pre_functions.expense_loss_constants(pre_output)
    pre_functions.premium_without_fees(pre_output)

    //Subtotal calculation
    subtotal_functions.icc_premium(property_info,pre_output)
    subtotal_functions.icc_premium_with_crs_discount(pre_output,peril_info)
    subtotal_functions.subtotal(pre_output)
    subtotal_functions.reserve_fund_factor_probation_surcharge(pre_output, property_info)
    subtotal_functions.subtotal_with_reserve(pre_output)

    //premium with fees
    fees_functions.hfiaa_surcharge(property_info,pre_output)
    fees_functions.federal_policy_fee(pre_output, property_info)
    fees_functions.premium_with_fees(pre_output)
    
    return {
        premium: pre_output
    }
}


function geo_output_calculation(geo_response, geo_info){
    //delete params
    delete geo_info.segment;
    geo_response.forEach(item=>{
        const peril_keys = Object.keys(item)
        peril_keys.forEach(key=>{
            geo_info[key] = {...geo_info[key], ...item[key]}
        })
    })
    let peril_keys = Object.keys(geo_info)
    peril_keys.forEach(peril_key=>{
        const factor_keys = Object.keys(geo_info[peril_key])
        factor_keys.forEach(factor_key=>{
            geo_info[peril_key]['geo_factor'] = (geo_info[peril_key]['geo_factor']!==undefined ? geo_info[peril_key]['geo_factor'] : 1)  * geo_info[peril_key][factor_key]
        })
    })
}

function ph_output_calculation(ph_response, peril_info, geo_info, property_info){
    let peril_keys = Object.keys(geo_info)
    ph_response.forEach(item=>{
        peril_keys.forEach(key=>{
            peril_info[key] = {...peril_info[key], ...item[key]}
        })
    })
    peril_keys.forEach(peril_key=>{
        peril_info[peril_key]['initial_deductible_and_itv'] = peril_info[peril_key]['deductable_and_limit_to_coverage_value_ratio'] - peril_info[peril_key]['deductable_to_coverage_value_ratio']
        if(property_info.coverage_a_limit == 0){
            peril_info[peril_key]['final_deductible_and_itv'] = 0
        } else {
            peril_info[peril_key]['final_deductible_and_itv'] = Math.max(0.01,peril_info[peril_key]['initial_deductible_and_itv'])
        }
        const exluded_params = ['deductable_to_coverage_value_ratio','crs_discount_percent','deductable_and_limit_to_coverage_value_ratio'];
        const factor_keys = Object.keys(peril_info[peril_key]);
        let peril_value = 1;
        factor_keys.forEach(key=>{
            if(exluded_params.indexOf(key)==-1 && peril_info[peril_key][key]){
                peril_value = peril_value * peril_info[peril_key][key]
            }
        })
        peril_info[peril_key]['rate_by_peril'] = geo_info[peril_key]['geo_factor'] * peril_value;
    })
}
