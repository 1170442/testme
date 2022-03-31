const AWS = require("aws-sdk");
const dynamoDbClient = new AWS.DynamoDB.DocumentClient();
const ORCHESTRATOR_TABLE = process.env.ORCHESTRATOR_TABLE;
const REGION = process.env.REGION;
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const _ = require("lodash");
const Utils = require('./utils/utils');
const Constants = require('./utils/constants');
const Dynamo = require('./utils/dynamo_operations');

module.exports.orchestrator = async (event) => {
    const topicArn = event.Records[0].Sns.TopicArn;
    console.log(`*== Event received from subscription: ${topicArn}`);
    if (topicArn.includes(Constants.RISK_EVAL_CREATED)) {
        const message = JSON.parse(event.Records[0].Sns.Message);
        await processServices(message);
    }
    else {
        const svc = fetchServiceName(event);
        console.log(`<<== Service ==>>: ${svc}`);
        const message = await updateState(event)
        if (!topicArn.includes(Constants.RISK_PRICING_COMPLETED)) {
            await processServices(message);
        }
    }

    async function processServices(message) {
        const services = message.product.services;
        console.log("== ProcessServices: ", services);
        let publishPromises = [];
        for (service of services) {
            if (service.dependency.length === 0 && service.status !== 'completed') {
                console.log("== IF Processing: ", service);
                try {
                    const payload = _.omit(message, ['product']);
                    publishPromises.push(Utils.publishSNS(payload, `mga_${service.name}_start`));
                }
                catch (err) {
                    console.log(`== Errored in processServices (if) in Orchestrator for ${service.name}: `, err)
                }
            }
            else if (service.dependency.length !== 0 && service.status !== 'completed') {
                console.log("== ELSE Processing: ", service);
                const dependencyServices = service.dependency;
                let dependencyCompleted = 0;

                dependencyServices.forEach(dep => {
                    const depFiltered = services.filter(item => (
                        dep === item.name && item.status === 'completed'
                    ))
                    dependencyCompleted += depFiltered.length;
                })

                if (dependencyCompleted === service.dependency.length) {
                    try {
                        const payload = _.omit(message, ['product']);
                        publishPromises.push(Utils.publishSNS(payload, `mga_${service.name}_start`));
                    }
                    catch (err) {
                        console.log(`== Errored in processServices (else) in Orchestrator for ${service.name}: `, err)
                    }
                }
            }
            else {
                console.log(`***===*** ${service.name} process is completed ***===***`)
            }
        };
        console.log("== Publishing Promises: ", publishPromises);
        const status = await Promise.all(publishPromises);
        console.log("== PromiseAll Status: ", status);
    }

    function replaceStr(str, find, replace) {
        for (let i = 0; i < find.length; i++) {
            str = str.replace(new RegExp(find[i], 'gi'), replace[i]);
        }
        return str;
    }

    async function updateState(event) {
        const message = JSON.parse(event.Records[0].Sns.Message);
        const service_name = fetchServiceName(event);
        const payload = await fetchLatestState(message._id);
        const services = payload.product.services;
        const service_payload = _.omit(message, ['_id']);
        payload[service_name] = service_payload;

        const updatedServices = services.map((service) => {
            if (event.Records[0].Sns.TopicArn.includes(service.name)) {
                service.status = 'completed';
            }
            console.log("== Service: ", service)
            return service;
        });
        payload.product.services = updatedServices;

        try {
            console.log("== Update Completed State DB: ", payload);
            await Dynamo.putData(ORCHESTRATOR_TABLE, payload);
            return payload;
        } catch (error) {
            console.log(error);
        }
    }

    async function fetchLatestState(id) {
        try {
            return Dynamo.getData(ORCHESTRATOR_TABLE, '_id', id);
        }
        catch (err) {
            console.log("== Error in getting data: ", err);
        }
    }

    function fetchServiceName(event) {
        const arn = `arn:aws:sns:${REGION}:${ACCOUNT_ID}:`;
        const find = ["mga_", "_completed", "flood_", arn];
        const replace = ['', '', '', ''];
        let service_name = event.Records[0].Sns.TopicArn;
        service_name = replaceStr(service_name, find, replace);

        return service_name;
    }
}
