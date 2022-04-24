const QUOTE_ORCHESTRATOR_TABLE = process.env.QUOTE_ORCHESTRATOR_TABLE;
const REGION = process.env.REGION;
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const _ = require("lodash");
const Utils = require('../../utils/utils');
const Constants = require('../../utils/constants');
const Dynamo = require('../../utils/dynamo_operations');
const MODULE_NAME = 'quote';

module.exports.orchestrator = async (event) => {
    const topicArn = event.Records[0].Sns.TopicArn;
    console.log(`*== Event received from subscription: ${topicArn}`);
    if (topicArn.includes(Constants.QUOTE_CREATED)) {
        const message = JSON.parse(event.Records[0].Sns.Message);
        console.log(`%%%%%%%%====%%%%%%%%  ${JSON.stringify(message)}`);
        await processServices(message);
    }
    else {
        const svc = fetchServiceName(event);
        console.log(`<<== Service ==>>: ${svc}`);
        const message = await updateState(event)
        await processServices(message);
    }

    async function processServices(message) {
        const services = message.product.services;
        console.log("== ProcessServices: ", services);
        let publishPromises = [];
        for (service of services) {
            if (!service.modules.includes(MODULE_NAME)) {
                continue;
            }

            if (service.dependency.length === 0 && service.status !== Constants.COMPLETED) {
                console.log("== IF Processing: ", service);
                try {
                    const payload = _.omit(message, ['product']);
                    payload.service = service;
                    publishPromises.push(Utils.publishSNS(payload, service.topic));
                }
                catch (err) {
                    console.log(`== Errored in processServices (if) in Orchestrator for ${service.name}: `, err)
                }
            }
            else if (service.dependency.length !== 0 && service.status !== Constants.COMPLETED) {
                console.log("== ELSE Processing: ", service);
                const dependencyServices = service.dependency;
                let dependencyCompleted = 0;

                dependencyServices.forEach(dep => {
                    const depFiltered = services.filter(item => (
                        dep === item.name && item.status === Constants.COMPLETED
                    ))
                    dependencyCompleted += depFiltered.length;
                })

                if (dependencyCompleted === service.dependency.length) {
                    try {
                        const payload = _.omit(message, ['product']);
                        payload.service = service;
                        publishPromises.push(Utils.publishSNS(payload, service.topic));
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
        if(typeof message._id !== 'undefined'){
            message.quote_request_id = message._id;
        }
        console.log(`++ ${message.service_name}:  ${JSON.stringify(message)}`);
        const service_name = message.service_name;
        console.log(`== Quote Request ID: ${message.quote_request_id} -- ${message._id} == ${JSON.stringify(message)}`);
        const payload = await fetchLatestState(message.quote_request_id);
        console.log(`== PAYLOAD from fetchLatestState: ${JSON.stringify(payload)}`);
        const services = payload.product.services;
        const service_payload = _.omit(message, ['_id', 'quote_request_id', 'service_name']);
        payload[service_name] = service_payload;

        const updatedServices = services.map((service) => {
            if (event.Records[0].Sns.TopicArn.includes(service.name)) {
                service.status = Constants.COMPLETED;
            }
            console.log("== Service: ", service)
            return service;
        });
        payload.product.services = updatedServices;

        try {
            console.log("== Update Completed State DB: ", payload);
            await Dynamo.putData(QUOTE_ORCHESTRATOR_TABLE, payload);
            return payload;
        } catch (error) {
            console.log(error);
        }
    }

    async function fetchLatestState(id) {
        try {
            return Dynamo.getData(QUOTE_ORCHESTRATOR_TABLE, 'quote_request_id', id);
        }
        catch (err) {
            console.log("== Error in getting data: ", err);
        }
    }

    function fetchServiceName(event) {
        const arn = `arn:aws:sns:${REGION}:${ACCOUNT_ID}:`;
        const find = ["mga_", "_completed", arn];
        const replace = ['', '', ''];
        let service_name = event.Records[0].Sns.TopicArn;
        service_name = replaceStr(service_name, find, replace);

        return service_name;
    }
}