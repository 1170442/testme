// const URL = "http://localhost:4000"
const URL = "http://mgageodataapi.marshlabs.dev:4000"
const axios = require('axios')
const _ = require('lodash');
const INLAND_FLOOD = 'inland_flood';
const STORM_SURGE = 'storm_surge';
const TSUNAMI = 'tsunami'
const GREAT_LAKES = 'great_lakes';
const COASTAL_EROSION = 'coastal_erosion'


exports.icc_premium = (property,pre_output)=>{
    pre_output['icc_premium'] = property['icc_premium'];
}

exports.icc_premium_with_crs_discount = (pre_output,ph_output)=>{
    pre_output['icc_premium_with_crs_discount'] = ph_output['inland_flood']['crs_discount_factor'] * pre_output['icc_premium'];
}

exports.subtotal = (pre_output)=>{
    pre_output['subtotal'] =  pre_output['premium_without_fees'] + pre_output['icc_premium_with_crs_discount'];
}

//CONSTANT
exports.reserve_fund_factor_probation_surcharge = (property, pre_output)=>{
    pre_output['reserve_fund_factor'] = property.reserve_fund;
}

exports.subtotal_with_reserve = (pre_output)=>{
    pre_output['subtotal_with_reserve'] = pre_output['subtotal'] + pre_output['icc_premium_with_crs_discount'];
}