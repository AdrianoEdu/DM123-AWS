import { Callback } from "aws-lambda";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import * as AWSXRay from 'aws-xray-sdk';
import { time } from "console";
import { Context } from "vm";

AWSXRay.captureAWS(require('aws-sdk'));

const eventsDdb = process.env.EVENTS_DDB!;
const ddbClient = new DocumentClient();

export enum ProductEventType {
    CREATED = "PRODUCT_CREATED",
    UPDATED = "PRODUCT_UPDATED",
    DELETED = "PRODUCT_DELETED"
}

export interface ProductEvent {
    requestId: string;
    eventType: ProductEventType;
    productId: string;
    productCode: string;
    productPrice: number;
    email: string;
}

export async function handler(event: ProductEvent, context: Context, callback:Callback): Promise<void> {
    //TODOS - remover esse log.
    console.log(event);

    console.log(`API Gateway RequestId: ${event.requestId} - LambdaRequestID: ${context.requestId}` );

    await createEvent(event);

    callback(null, JSON.stringify({
        productEventCreated: true,
        message: 'OK'
    }))
}

function createEvent(event: ProductEvent) {
    const timestamp = Date.now();

    const ttl = ~~(timestamp / 1000 + 5  * 60);

    return ddbClient.put({
        TableName: eventsDdb,
        Item: {
            pk: `#product_${event.productCode}`,
            sk: `${event.eventType}#${timestamp}`,
            email: event.email,
            createdAt: timestamp,
            requestId: event.requestId,
            eventType: event.eventType,
            ttl: ttl,
            info: {
                productId: event.productId,
                price: event.productPrice,
            },
        }
    }).promise()
}