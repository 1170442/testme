// const URL = "http://localhost:4000"
const URL = "http://mgageodataapi.marshlabs.dev:4000"
const axios = require('axios')
const INLAND_FLOOD = 'inland_flood';
const STORM_SURGE = 'storm_surge';
const TSUNAMI = 'tsunami'
const GREAT_LAKES = 'great_lakes';
const COASTAL_EROSION = 'coastal_erosion'

exports.type_of_use = async (property) => {
    console.log(`step: physical : type of use`)
    const { data } = await axios.get(`${URL}/type_of_use/search`, {
        params: {
            type_of_use: property.type_of_use,
        }
    })
    if (!data) return false;
    return {
        inland_flood: {
            type_of_use: data.inland_flood
        },
        storm_surge: {
            type_of_use: data.storm_surge
        },
        tsunami: {
            type_of_use: data.tsunami
        },
        great_lakes: {
            type_of_use: data.great_lakes
        },
        coastal_erosion: {}
    }
}

exports.floors_of_interest = async (property) => {
    console.log(`step: physical : floors_of_interest`)
    const { data } = await axios.get(`${URL}/floors_of_interest/search`, {
        params: {
            single_family_home_indicator: property.single_family_home_indicator,
            condo_unit_owner_indicator: property.condo_unit_owner_indicator,
            floors_of_interest: property.floors_of_interest,
        }
    })
    if (!data) return false;
    return {
        inland_flood: {
            floors_of_interest: data.inland_flood
        },
        storm_surge: {
            floors_of_interest: data.storm_surge
        },
        tsunami: {
            floors_of_interest: data.tsunami
        },
        great_lakes: {
            floors_of_interest: data.great_lakes
        },
        coastal_erosion: {}
    }
}

exports.foundation_type = async (property) => {
    console.log(`step: physical : floors_of_interest`)
    const { data } = await axios.get(`${URL}/foundation_type/search`, {
        params: {
            foundation_type: property.foundation_type,
        }
    })
    if (!data) return false;
    return {
        inland_flood: {
            foundation_type: data.inland_flood
        },
        storm_surge: {
            foundation_type: data.storm_surge
        },
        tsunami: {
            foundation_type: data.tsunami
        },
        great_lakes: {
            foundation_type: data.great_lakes
        },
        coastal_erosion: {}
    }
}


//TODO
exports.first_floor_height = async (property) => {
    console.log(`step: physical : first_floor_height`)
    const { data } = await axios.get(`${URL}/first_floor_height/search`, {
        params: {
            first_floor_height: property.first_floor_height,
        }
    })
    if (property.flood_vents == "No") 
        flood_value = "no_flood_vents"
    else
    flood_value = "with_flood_vents"
    if (!data) return false;
    let lower_ff_info = data[0].all_perils_excluding_coastal_erosion;
    let higher_ff_info = data[1].all_perils_excluding_coastal_erosion;
    let lower_limit_value = lower_ff_info[property.foundation_design][flood_value]
    let upper_limit_value = higher_ff_info[property.foundation_design][flood_value]
    let upper_limit = data[1].first_floor_height
    let lower_limit = data[0].first_floor_height
    let result;
    if (data[0].first_floor_height == data[1].first_floor_height) {
        result = lower_ff_info[property.foundation_design][flood_value]
    } else {
        result = value_projection(property.first_floor_height, upper_limit, upper_limit_value, lower_limit, lower_limit_value)
    }
    return {
        inland_flood: {
            first_floor_height: result
        },
        storm_surge: {
            first_floor_height: result
        },
        tsunami: {
            first_floor_height: result
        },
        great_lakes: {
            first_floor_height: result
        },
        coastal_erosion: {}
    }
}

exports.me_above_first_floor = async (property) => {
    console.log(`step: physical : me_above_first_floor`)
    const { data } = await axios.get(`${URL}/me_above_first_floor/search`, {
        params: {
            machinery_and_equipment_above_first_floor: property.machinery_and_equipment_above_first_floor,
        }
    })
    if (!data) return false;
    let ff_info = data.all_perils_excluding_coastal_erosion;
    return {
        inland_flood: {
            machinery_and_equipment_above_first_floor: ff_info
        },
        storm_surge: {
            machinery_and_equipment_above_first_floor: ff_info
        },
        tsunami: {
            machinery_and_equipment_above_first_floor: ff_info
        },
        great_lakes: {
            machinery_and_equipment_above_first_floor: ff_info
        },
        coastal_erosion: {}
    }
}

exports.coverage_value_factor = async (property) => {
    return {
        inland_flood: {
            coverage_value_factor: 1
        },
        storm_surge: {
            coverage_value_factor: 1
        },
        tsunami: {
            coverage_value_factor: 1
        },
        great_lakes: {
            coverage_value_factor: 1
        },
        coastal_erosion: {}
    }
}

exports.deductible_and_limit_to_coverage_value_ratio = async (property) => {

    console.log(`step: physical : deductible_limit_itv_cov_a`)
    let ratio = (property.coverage_a_deductable + property.coverage_a_limit) / property.coverage_a_value;
    if (ratio < 0) {
        ratio = 0
    } else if (ratio > 1) {
        ratio = 1
    }

    if (ratio > 0.01) {
        ratio = ratio.toFixed(2)
    }

    const { data } = await axios.get(`${URL}/deductible_limit_itv_cov_a/search`, {
        params: {
            deductable_and_limit_to_coverage_value_ratio: ratio,
        }
    })
    let inland_ratio, others_ratio;
    if (!data) return false;
    if (data[0][INLAND_FLOOD] == data[1][INLAND_FLOOD] || !data[1]) {
        inland_ratio = data[0][INLAND_FLOOD]
    } else {
        inland_ratio = value_projection(ratio, 
                    data[1]['deductable_and_limit_to_coverage_value_ratio'], 
                    data[1][INLAND_FLOOD], 
                    data[0]['deductable_and_limit_to_coverage_value_ratio'], 
                    data[0][INLAND_FLOOD])
    }

    if (data[0]['storm_surge_tsunami_great_lakes_and_coastal_erosion'] == data[1]['storm_surge_tsunami_great_lakes_and_coastal_erosion'] || !data[1]) {
        others_ratio = data[0]['storm_surge_tsunami_great_lakes_and_coastal_erosion']
    } else {
        others_ratio = value_projection(ratio, 
                    data[1]['deductable_and_limit_to_coverage_value_ratio'], 
                    data[1]['storm_surge_tsunami_great_lakes_and_coastal_erosion'], 
                    data[0]['deductable_and_limit_to_coverage_value_ratio'], 
                    data[0]['storm_surge_tsunami_great_lakes_and_coastal_erosion'])
    }
    return {
        inland_flood: {
            deductable_and_limit_to_coverage_value_ratio: inland_ratio
        },
        storm_surge: {
            deductable_and_limit_to_coverage_value_ratio:  others_ratio
        },
        tsunami: {
            deductable_and_limit_to_coverage_value_ratio: others_ratio
        },
        great_lakes: {
            deductable_and_limit_to_coverage_value_ratio: others_ratio
        },
        coastal_erosion: {
            deductable_and_limit_to_coverage_value_ratio: others_ratio
        }
    }
}

exports.deductible_to_coverage_value_ratio = async (property) => {

    console.log(`step: physical : deductible__itv_cov_a`)
    let ratio = (property.coverage_a_deductable) / property.coverage_a_value;
    if (ratio < 0) {
        ratio = 0
    } else if (ratio > 1) {
        ratio = 1
    }

    if (ratio > 0.01) {
        ratio = ratio.toFixed(2)
    }

    const { data } = await axios.get(`${URL}/deductible_itv_cov_a/search`, {
        params: {
            deductable_to_coverage_value_ratio: ratio,
        }
    })
    let inland_ratio, others_ratio;
    if (!data) return false;
    if (data[0][INLAND_FLOOD] == data[1][INLAND_FLOOD] || !data[1]) {
        inland_ratio = data[0][INLAND_FLOOD]
    } else {
        inland_ratio = value_projection(ratio, 
                    data[1]['deductable_to_coverage_value_ratio'], 
                    data[1][INLAND_FLOOD], 
                    data[0]['deductable_to_coverage_value_ratio'], 
                    data[0][INLAND_FLOOD])
    }

    if (data[0]['storm_surge_tsunami_great_lakes_and_coastal_erosion'] == data[1]['storm_surge_tsunami_great_lakes_and_coastal_erosion'] || !data[1]) {
        others_ratio = data[0]['storm_surge_tsunami_great_lakes_and_coastal_erosion']
    } else {
        others_ratio = value_projection(ratio, 
                    data[1]['deductable_to_coverage_value_ratio'], 
                    data[1]['storm_surge_tsunami_great_lakes_and_coastal_erosion'], 
                    data[0]['deductable_to_coverage_value_ratio'], 
                    data[0]['storm_surge_tsunami_great_lakes_and_coastal_erosion'])
    }
    return {
        inland_flood: {
            deductable_to_coverage_value_ratio: inland_ratio
        },
        storm_surge: {
            deductable_to_coverage_value_ratio:  others_ratio
        },
        tsunami: {
            deductable_to_coverage_value_ratio: others_ratio
        },
        great_lakes: {
            deductable_to_coverage_value_ratio: others_ratio
        },
        coastal_erosion: {
            deductable_to_coverage_value_ratio: others_ratio
        }
    }
}

exports.concentration_risk = async (property) => {
    console.log(`step: physical : concentration risk`)
    const { data } = await axios.get(`${URL}/concentration_risk/search`, {
        params: {
            msa: property.msa,
        }
    })
    if (!data) return false;
    return {
        inland_flood: {
            concentration_risk: data.inland_flood
        },
        storm_surge: {
            concentration_risk: data.storm_surge
        },
        tsunami: {},
        great_lakes: {},
        coastal_erosion: {}
    }
}

exports.crs_discount_percent = async (property) => {
    console.log(`step: physical : crs discount percent`)
    return {
        inland_flood: {
            crs_discount_percent: property.crs_discount_percent
        },
        storm_surge: {
            crs_discount_percent: property.crs_discount_percent
        },
        tsunami: {
            crs_discount_percent: property.crs_discount_percent
        },
        great_lakes: {
            crs_discount_percent: property.crs_discount_percent
        },
        coastal_erosion: {
            crs_discount_percent: property.crs_discount_percent
        }
    }
}

exports.crs_discount_factor = async (property) => {
    console.log(`step: physical : crs discount factor`)
    crs_discount_factor = 1 - (property.crs_discount_percent/100)
    return {
        inland_flood: {
            crs_discount_factor: crs_discount_factor
        },
        storm_surge: {
            crs_discount_factor: crs_discount_factor
        },
        tsunami: {
            crs_discount_factor: crs_discount_factor
        },
        great_lakes: {
            crs_discount_factor: crs_discount_factor
        },
        coastal_erosion: {
            crs_discount_factor: crs_discount_factor
        }
    }
}

function value_projection(given_value, upper_limit, upper_limit_value, lower_limit, lower_limit_value) {
    if (lower_limit_value > upper_limit_value) { //inversly proportaional
        const value = lower_limit_value - ((lower_limit_value - upper_limit_value) / (upper_limit - lower_limit)) * (given_value - lower_limit);
        return value;
    } else { //direct proportional
        const value = lower_limit_value + ((upper_limit_value - lower_limit_value) / (upper_limit - lower_limit)) * (given_value - lower_limit);
        return value;
    }

}