const geo_functions = require('./geofactors')
const ph_functions = require('./physicalfactors')
const pre_functions = require('./premiumfactors')
const subtotal_functions = require('./subtotal')
const fees_functions = require('./premiumwithfees')
exports.risk_scoring = async(property_info)=>{
    let geo_info = {}
    const base_rate = await geo_functions.base_rate(property_info);
    geo_info = {...geo_info,...base_rate}
    property_info = {...property_info, segment: base_rate.segment }
    const geo_promises = [
        geo_functions.distance_to_river(property_info),
        geo_functions.elevation_relative_to_river(property_info),
        geo_functions.drainage_area(property_info),
        geo_functions.structural_relative_elevation(property_info),
        geo_functions.territory(property_info),
        geo_functions.distance_to_coast_by_barrier_island_indicator_storm_tsunami(property_info),
        geo_functions.distance_to_coast_coastal_erosion(property_info),
        geo_functions.distance_to_ocean(property_info),
        geo_functions.elevation_to_barrier_island_indicator(property_info),
        geo_functions.distance_to_lake(property_info),
        geo_functions.elevation_relative_to_lake(property_info)
    ]
    const geo_response = await Promise.all(geo_promises)
    geo_output_calculation(geo_response, geo_info)
    

    //calculate the physical parameters
    const peril_info = {}
    const ph_promises = [
        ph_functions.type_of_use(property_info),
        ph_functions.floors_of_interest(property_info),
        ph_functions.foundation_type(property_info),
        ph_functions.first_floor_height(property_info),
        ph_functions.me_above_first_floor(property_info),
        ph_functions.coverage_value_factor(property_info),
        ph_functions.deductible_and_limit_to_coverage_value_ratio(property_info),
        ph_functions.deductible_to_coverage_value_ratio(property_info),
        ph_functions.concentration_risk(property_info),
        ph_functions.crs_discount_percent(property_info),
        ph_functions.crs_discount_factor(property_info),
    ]
    const ph_response = await Promise.all(ph_promises)
    ph_output_calculation(ph_response, peril_info, geo_info, property_info);
    console.log(peril_info)

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
        geo_info,
        peril_info,
        property_info
    }
}


function geo_output_calculation(geo_response, geo_output){
    //delete params
    delete geo_output.segment;
    geo_response.forEach(item=>{
        const peril_keys = Object.keys(item)
        peril_keys.forEach(key=>{
            geo_output[key] = {...geo_output[key], ...item[key]}
        })
    })
    let peril_keys = Object.keys(geo_output)
    peril_keys.forEach(peril_key=>{
        const factor_keys = Object.keys(geo_output[peril_key])
        factor_keys.forEach(factor_key=>{
            geo_output[peril_key]['geo_factor'] = (geo_output[peril_key]['geo_factor']!==undefined ? geo_output[peril_key]['geo_factor'] : 1)  * geo_output[peril_key][factor_key]
        })
    })
}

function ph_output_calculation(ph_response, ph_output, geo_output, property){
    let peril_keys = Object.keys(geo_output)
    ph_response.forEach(item=>{
        peril_keys.forEach(key=>{
            ph_output[key] = {...ph_output[key], ...item[key]}
        })
    })
    peril_keys.forEach(peril_key=>{
        ph_output[peril_key]['initial_deductible_and_itv'] = ph_output[peril_key]['deductable_and_limit_to_coverage_value_ratio'] - ph_output[peril_key]['deductable_to_coverage_value_ratio']
        if(property.coverage_a_limit == 0){
            ph_output[peril_key]['final_deductible_and_itv'] = 0
        } else {
            ph_output[peril_key]['final_deductible_and_itv'] = Math.max(0.01,ph_output[peril_key]['initial_deductible_and_itv'])
        }
        const exluded_params = ['deductable_to_coverage_value_ratio','crs_discount_percent','deductable_and_limit_to_coverage_value_ratio'];
        const factor_keys = Object.keys(ph_output[peril_key]);
        let peril_value = 1;
        factor_keys.forEach(key=>{
            if(exluded_params.indexOf(key)==-1 && ph_output[peril_key][key]){
                peril_value = peril_value * ph_output[peril_key][key]
            }
        })
        ph_output[peril_key]['rate_by_peril'] = geo_output[peril_key]['geo_factor'] * peril_value;
    })
}
