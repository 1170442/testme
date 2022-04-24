const AWS = require("aws-sdk");
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();

module.exports.getData = async (table_name, key_id, key_value) => {
    const params = {};
    params.TableName = table_name;
    params.Key = {};
    params.Key[key_id] = key_value;

    try {
        const response = await dynamoDbClient.get(params).promise();
        return response.Item;
    }
    catch (err) {
        console.log("== DynamoDB Error: Failed to GET response", err)
    }
}

module.exports.putData = async (table_name, message) => {
    const params = {};
    params.TableName = table_name;
    params.Item = message;

    try {
        await dynamoDbClient.put(params).promise();
    }
    catch (err) {
        console.log("== DynamoDB Error: Failed to PUT response", err)
    }
}