const AWS = require("aws-sdk");
const REGION = process.env.REGION;
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const SNS = new AWS.SNS({ region: REGION });

module.exports.publishSNS = (data, topicSubscription) => {
    const params = {
        Message: JSON.stringify(data),
        TopicArn: `arn:aws:sns:${REGION}:${ACCOUNT_ID}:${topicSubscription}`
    }
    console.log("==Publishing SNS with payload: ", params);
    return SNS.publish(params).promise();
}

module.exports.fetchParties = (partyObj, role) => {
    const parties = [];
    
    for(let party of partyObj){
        if(party.role === role){
            parties.push(party);
        }
    }

    return parties;
}