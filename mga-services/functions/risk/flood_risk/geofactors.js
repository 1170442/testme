// const URL = "http://localhost:4000"
const URL = "http://mgageodataapi.marshlabs.dev:4000"
const axios = require('axios')
const INLAND_FLOOD = 'inland_flood';
const STORM_SURGE = 'storm_surge';
const TSUNAMI = 'tsunami'
const GREAT_LAKES = 'great_lakes';
const COASTAL_EROSION = 'coastal_erosion'

exports.base_rate = async (property) => {
    console.log(`step: base rate`)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/base_rates/search`, {
        params: {
            is_levee: type,
            region: property.state,
            single_family_home_indicator: property.type_of_use.indexOf('SINGLE') && property.type_of_use.indexOf('FAMILY') ? 'Yes': 'No',
        }
    })
    if (!data) return false;
    return {
        inland_flood:{
            base_rate: data.inland_flood.building
        },
        storm_surge: {
            base_rate: property.barrier_island_indicator =="No" ? data.storm_surge.non_barrier_island.building : data.storm_surge.barrier_island.building
        },
        tsunami:{
            base_rate: data.tsunami.building
        },
        great_lakes: {
            base_rate: data.great_lakes.building
        },
        coastal_erosion: {
            base_rate: data.coastal_erosion.building
        },
        segment: data.segment
    }
}

exports.distance_to_river = async (property) => {
    console.log(`step: distance to river`)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/dtr/search`, {
        params: {
            is_levee: type,
            region: `Segment ${property.segment}`,
            distance_to_river: property.distance_to_river,
        }
    })
    let distance_to_river;
    if (!data) return false;
    if((data[0].flood || data[0].flood!=undefined) && !data[1]){
        distance_to_river = data[0].flood
    }else if(data[0].flood==data[1].flood){
        distance_to_river = data[1].flood 
    }
    else{
        distance_to_river = value_projection(property.distance_to_river, 
            data[1].distance_to_river,
            data[1].flood,
            data[0].distance_to_river,
            data[0].flood,
            )
    }
    return {
        inland_flood :{ distance_to_river}
    }
}

exports.elevation_relative_to_river = async (property) => {
    console.log(`step: elevation relative to river`)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/elev_rel_river/search`, {
        params: {
            is_levee: type,
            river_class: property.river_class,
            elevation_relative_to_river: property.elevation_relative_to_river,
        }
    })
    const segment = `segment${property.segment}`
    let elevation_relative_to_river;
    if (!data) return false;
    if((data[0][INLAND_FLOOD][segment] || data[0][INLAND_FLOOD][segment]!=undefined) && !data[1]){
        elevation_relative_to_river = data[0][INLAND_FLOOD][segment]
    } else if(data[0][INLAND_FLOOD][segment]==data[1][INLAND_FLOOD][segment]){
        elevation_relative_to_river = data[1][INLAND_FLOOD][segment]
    }
    else if(data[0][INLAND_FLOOD][segment] != data[1][INLAND_FLOOD][segment]){
        elevation_relative_to_river =  value_projection(
            property.elevation_relative_to_river,
            data[1].elevation_relative_to_river,
            data[1][INLAND_FLOOD][segment],
            data[0].elevation_relative_to_river,
            data[0][INLAND_FLOOD][segment]
        )
    }
    return {
        inland_flood :{ elevation_relative_to_river}
    }
}

exports.drainage_area = async (property) => {
    console.log(`step: drainage area`)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/drainage_area/search`, {
        params: {
            is_levee: type,
            drainage_area: property.drainage_area,
        }
    })
    const segment = `segment${property.segment}`
    let drainage_area;
    if (!data) return false;
    if(data[0][INLAND_FLOOD][segment]==data[1][INLAND_FLOOD][segment]){
        drainage_area = data[1][INLAND_FLOOD][segment] 
    }
    else {
        drainage_area =  value_projection(
            property.drainage_area,
            data[1].drainage_area,
            data[1][INLAND_FLOOD][segment],
            data[0].drainage_area,
            data[0][INLAND_FLOOD][segment],
        )
    }
    return {
        inland_flood :{ drainage_area }
    }
}

exports.structural_relative_elevation = async (property) => {
    console.log(`step: structural relative elevation`)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/struct_rel_elev/search`, {
        params: {
            is_levee: type,
            region: `Segment ${property.segment}`,
            structural_relative_elevation: property.structural_relative_elevation,
        }
    })
    let structural_relative_elevation;
    if (!data) return false;
    if(data[0][INLAND_FLOOD] && !data[1]){
        structural_relative_elevation = data[0][INLAND_FLOOD]
    }
    else if(data[0][INLAND_FLOOD]==data[1][INLAND_FLOOD]){
        structural_relative_elevation = data[1][INLAND_FLOOD]
    }
    else {
        structural_relative_elevation =  value_projection(
            property.structural_relative_elevation,
            data[1].structural_relative_elevation,
            data[1][INLAND_FLOOD],
            data[0].structural_relative_elevation,
            data[0][INLAND_FLOOD],
        )
    }
    return {
        inland_flood :{ structural_relative_elevation }
    }
}

exports.territory = async (property) => {
    console.log(`step: territory - inland_storm`)

    let type = property.is_levee ? 'l' : 'nl'
    var { data } = await axios.get(`${URL}/${type}_territory/search`, {
        params: {
            barrier_island_indicator: property.barrier_island_indicator,
            huc6: property.huc12.substring(0,6),
        }
    })
    let inland_territory, storm_territory, gl_territory, tsunami_territory;
    if (data == "Unable to find matching document"){
        inland_territory = 1
        storm_territory = 1
    }
    else {
        inland_territory =  calculate_mean(data[INLAND_FLOOD]['minimum'],data[INLAND_FLOOD]['maximum'])
        storm_territory = calculate_mean(data[STORM_SURGE]['minimum'],data[STORM_SURGE]['maximum'])
    }

    console.log(`step: territory - tsunami & great lake `)
    var { data } = await axios.get(`${URL}/territory_tsugl/search`, {
        params: {
            is_levee: type,
            huc6: property.huc12.substring(0,6),
        }
    })
    if (data == "Unable to find matching document"){
        tsunami_territory = 1
        gl_territory = 1
    }
    else {
        tsunami_territory =  calculate_mean(data[TSUNAMI]['minimum'],data[TSUNAMI]['maximum'])
        gl_territory = calculate_mean(data[GREAT_LAKES]['minimum'],data[GREAT_LAKES]['maximum'])
    }

    return {
        inland_flood:{ territory:inland_territory},
        storm_surge: { territory:storm_territory},
        great_lakes: {territory: gl_territory},
        tsunami: {territory: tsunami_territory}
    }
}

exports.distance_to_coast_by_barrier_island_indicator_storm_tsunami =async (property)=>{
    if(property.segment == 3 || property.segment == 4){
        return {};
    }
    console.log(`step:  distance_to_coast_by_barrier_island_indicator`)
    const type = property.is_levee ? 'l' : 'nl';
    
    const { data } = await axios.get(`${URL}/${type}_dtc/search`, {
        params: {
            barrier_island_indicator: property.barrier_island_indicator,
            region: `Segment ${property.segment}`,
            distance_to_coast: property.distance_to_coast,
            is_levee: type,
        }
    })
    let storm_dtc, tsunamic_dtc;
    if (!data) return false;
    //storm dtc
    if(data[0].storm_surge && !data[1]){
        storm_dtc = data[0].storm_surge
    }
    else if(data[0].storm_surge==data[1].storm_surge){
        storm_dtc = data[1].storm_surge
    }
    else {
        storm_dtc =  value_projection(
            property.distance_to_coast,
            data[1].distance_to_coast,
            data[1].storm_surge,
            data[0].distance_to_coast,
            data[0].storm_surge,
        )
    }
    //tsunamic dtc
    if(data[0].tsunami && !data[1]){
        tsunamic_dtc = data[0].tsunami
    }
    else if(data[0].tsunami==data[1].tsunami){
        tsunamic_dtc = data[1].tsunami
    }
    else {
        tsunamic_dtc =  value_projection(
            property.distance_to_coast,
            data[1].distance_to_coast,
            data[1].tsunami,
            data[0].distance_to_coast,
            data[0].tsunami,
        )
    }
    return {
        storm_surge :{ 
            distance_to_coast: storm_dtc 
        },
        tsunami : {
            distance_to_coast : tsunamic_dtc
        }
    }
}

exports.distance_to_coast_coastal_erosion = async (property) => {
    console.log(`step: distance to coast - coastal erosion`)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/dtc_ce/search`, {
        params: {
            is_levee: type,
            distance_to_coast: property.distance_to_coast,
        }
    })
    let distance_to_coast;
    if (!data) return false;
    if((data[0][COASTAL_EROSION] || data[0][COASTAL_EROSION]!=undefined) && !data[1]){
        distance_to_coast = data[0][COASTAL_EROSION]
    }
    else if(data[0][COASTAL_EROSION]==data[1][COASTAL_EROSION]){
        distance_to_coast = data[1][COASTAL_EROSION]
    }
    else {
        distance_to_coast =  value_projection(
            property.distance_to_coast,
            data[1].distance_to_coast,
            data[1][COASTAL_EROSION],
            data[0].distance_to_coast,
            data[0][COASTAL_EROSION],
        )
    }
    return {
        coastal_erosion :{ distance_to_coast: distance_to_coast }
    }
}


exports.distance_to_ocean = async(property)=>{
    console.log(`step: distance to ocean `)
    let segment;
    if(['CA','OR','WA'].indexOf(property.state)!=-1){
        segment = property.state
    }else{
        segment = `Segment ${property.segment}`
    }
    const type = property.is_levee ? 'l' : 'nl'
    const bi_path = property.barrier_island_indicator =="No" ? `non_bi`: `bi`
    const { data } = await axios.get(`${URL}/dto/search`, {
        params: {
            region: segment,
            distance_to_ocean: property.distance_to_ocean,
            is_levee: type,
            barrier_island_indicator: property.barrier_island_indicator,
        }
    })
    let storm_dto, tsunami_dto;
    if (!data) return false;
    //get for storm
    if(segment == 'Segment 3' || segment == 'Segment 4' || segment == 'Segment 5'){
        return {};
    }
    else if((data[0][STORM_SURGE] || data[0][STORM_SURGE]!=undefined) && !data[1]){
        storm_dto = data[0][STORM_SURGE]
    }
    else if(data[0][STORM_SURGE]==data[1][STORM_SURGE]){
        storm_dto = data[1][STORM_SURGE]
    }
    else {
        storm_dto =  value_projection(
            property.distance_to_ocean,
            data[1].distance_to_ocean,
            data[1][STORM_SURGE],
            data[0].distance_to_ocean,
            data[0][STORM_SURGE],
        )
    }

    //Get for tsunami
    if(segment == 'Segment 3' || segment == 'Segment 4' || segment == 'Segment 5'){
        return {};
    }
    else if((data[0][TSUNAMI] || data[0][TSUNAMI]!=undefined) && !data[1]){
        tsunami_dto = data[0][TSUNAMI]
    }
    else if(data[0][TSUNAMI]==data[1][TSUNAMI]){
        tsunami_dto = data[1][TSUNAMI]
    }
    else {
        tsunami_dto =  value_projection(
            property.distance_to_ocean,
            data[1].distance_to_ocean,
            data[1][TSUNAMI],
            data[0].distance_to_ocean,
            data[0][TSUNAMI],
        )
    }
    return {
        storm_surge :{ distance_to_ocean: storm_dto },
        tsunami: { distance_to_ocean: tsunami_dto} 
    }
}

exports.elevation_to_barrier_island_indicator = async(property)=>{
    console.log(`step: elevation to barrier island indicator `)
    let segment;
    if(property.barrier_island_indicator=="No"){
        if(property.segment == 3){
            return {}
        }else if(property.segment == 1 || property.segment == 2){
            segment = `Segment ${property.segment}`
        }else if(property.segment == 4 && ['CA','OR','WA'].indexOf(property.state)!=-1){
            segment = property.state;
        }else if(['EK','AS','GU','HI','MP','PR','VI'].indexOf(property.state)!=-1){
            segment = property.state;
        }
    }else{
        if([3,4,5].indexOf(property.segment)!=-1){
            return {}
        }else {
            segment = `Segment ${property.segment}`
        }
    }
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/${type}_elevation/search`, {
        params: {
            region: segment,
            elevation: property.elevation,
            barrier_island_indicator: property.barrier_island_indicator
        }
    })
    let storm_elev_bi, tsunami_elev_bi;
    if (!data) return false;
    //get for storm
    if((data[0][STORM_SURGE] || data[0][STORM_SURGE]!=undefined) && !data[1]){
        storm_elev_bi = data[0][STORM_SURGE]
    }
    else if(data[0][STORM_SURGE]==data[1][STORM_SURGE]){
        storm_elev_bi = data[1][STORM_SURGE]
    }
    else {
        storm_elev_bi =  value_projection(
            property.elevation,
            data[1].elevation,
            data[1][STORM_SURGE],
            data[0].elevation,
            data[0][STORM_SURGE],
        )
    }

    //Get for tsunami
    if((data[0][TSUNAMI] || data[0][TSUNAMI]!=undefined) && !data[1]){
        tsunami_elev_bi = data[0][TSUNAMI]
    }
    else if(data[0][TSUNAMI]==data[1][TSUNAMI]){
        tsunami_elev_bi = data[1][TSUNAMI]
    }
    else {
        tsunami_elev_bi =  value_projection(
            property.elevation,
            data[1].elevation,
            data[1][TSUNAMI],
            data[0].elevation,
            data[0][TSUNAMI],
        )
    }
    return {
        storm_surge :{ elevation_to_barrier_island_indicator: storm_elev_bi },
        tsunami: { elevation_to_barrier_island_indicator: tsunami_elev_bi} 
    }
}

exports.distance_to_lake = async(property)=>{
    console.log(`step: distance to lake `)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/dtl/search`, {
        params: {
            is_levee: type,
            distance_to_lake: property.distance_to_lake,
        }
    })
    let dto;
    if (!data) return false;
    if((data[0][GREAT_LAKES] || data[0][GREAT_LAKES]!=undefined) && !data[1]){
        dto = data[0][GREAT_LAKES]
    }
    else if(data[0][GREAT_LAKES]==data[1][GREAT_LAKES]){
        dto = data[1][GREAT_LAKES]
    }
    else {
        dto =  value_projection(
            property.distance_to_lake,
            data[1].distance_to_lake,
            data[1][GREAT_LAKES],
            data[0].distance_to_lake,
            data[0][GREAT_LAKES],
        )
    }
    return {
        great_lakes :{ distance_to_lake: dto },
    }
}
exports.elevation_relative_to_lake = async(property)=>{
    console.log(`step: elevation relative to lake `)
    const type = property.is_levee ? 'l' : 'nl'
    const { data } = await axios.get(`${URL}/elev_rel_lake/search`, {
        params: {
            elevation_relative_to_lake: property.elevation_relative_to_lake,
            is_levee: type
        }
    })
    let elevation_relative_to_lake;
    if (!data) return false;
    if((data[0].great_lakes || data[0].great_lakes!=undefined) && !data[1]){
        elevation_relative_to_lake = data[0].great_lakes
    }
    else if(data[0].great_lakes==data[1].great_lakes){
        elevation_relative_to_lake = data[1].great_lakes
    }
    else {
        elevation_relative_to_lake =  value_projection(
            property.elevation_relative_to_lake,
            data[1].elevation_relative_to_lake,
            data[1].great_lakes,
            data[0].elevation_relative_to_lake,
            data[0].great_lakes,
        )
    }
    return {
        great_lakes :{ elevation_relative_to_lake },
    }
}


function value_projection(given_value, upper_limit, upper_limit_value, lower_limit, lower_limit_value){
    if(lower_limit_value>upper_limit_value){ //inversly proportaional
        const value = lower_limit_value - ((lower_limit_value - upper_limit_value)/(upper_limit-lower_limit))*(given_value-lower_limit);
        return value;
    }else{ //direct proportional
        const value = lower_limit_value + ((upper_limit_value - lower_limit_value)/(upper_limit-lower_limit))*(given_value-lower_limit);
        return value;
    }
    
}

function calculate_mean(min_value, max_value){
    return (min_value+max_value)/2;
}