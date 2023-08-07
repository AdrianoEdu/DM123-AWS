import { Context, SNSEvent, SNSMessage } from "aws-lambda";
import { AWSError } from "aws-sdk";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import DynamoDB = require("aws-sdk/clients/dynamodb");
import { PromiseResult } from "aws-sdk/lib/request";
import * as AWSXRay from 'aws-xray-sdk';

AWSXRay.captureAWS(require('aws-sdk'));

const eventsDdb = process.env.EVENTS_DDB!;
const ddbClient = new DocumentClient();

interface OrderEvent {
    email: string,
    orderId: string,
    shipping: {
        type: string,
        carrier: string
    }
    billing: {
        payment: string,
        totalPrice: number,
    },
    productCodes: string[],
    requestId: string,
}

enum OrderEventType {
    CREATED = "CREATED",
    DELETED = "DELETED",
}

interface OrderEventsDdb {
    pk: string,
    sk: string,
    ttl: number,
    email: string,
    createdAt: number,
    requestId: string,
    eventType: string,
    info: {
        orderId: string,
        productCodes: string[],
        messageId: string,
    }
}

export async function handler(event: SNSEvent, context: Context) {
    const promises: Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput,
    AWSError>>[] = [];

    event.Records.forEach((record) => {
        promises.push(createEvent(record.Sns));
    });

    await Promise.all(promises);

    return;
}

function createEvent(snsMessage: SNSMessage){
    const event = JSON.parse(snsMessage.Message) as OrderEvent;

    console.log(`Order event - MessageId: ${snsMessage.MessageId} - RequestId: ${event.requestId}`);

    const timestamp = Date.now();
    const ttl = ~~(timestamp / 1000 + 5 * 60);

    const eventType = snsMessage.MessageAttributes['eventType'].Value;

    const orderEventsDdb: OrderEventsDdb = {
        pk: `#order_${event.orderId}`,
        sk: `${eventType}#${timestamp}`,
        ttl: ttl,
        email: event.email,
        createdAt: timestamp,
        requestId: event.requestId,
        eventType: eventType,
        info: {
            orderId: event.orderId,
            productCodes: event.productCodes,
            messageId: snsMessage.MessageId,
        }
    }

    return ddbClient.put({
        TableName: eventsDdb,
        Item: orderEventsDdb
    }).promise();
}