import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { DocumentClient } from "aws-sdk/clients/dynamodb";
import { v4 as uuid } from 'uuid';
import * as AWSXRay from 'aws-xray-sdk';
import { Lambda } from 'aws-sdk';
import { ProductEvent, ProductEventType } from "./productEventsFunction";

AWSXRay.captureAWS(require('aws-sdk'));

export interface Product {
    id: string,
    productName: string,
    code: string,
    price: number,
    model: string,
    productUrl: string,
}

const productDdb = process.env.PRODUCTS_DDB!;
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME!;

const ddbClient = new DocumentClient();
const lambdaClient = new Lambda();

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
 
    const method = event.httpMethod;
    console.log(event);

    const apiRequestId = event.requestContext.resourceId;
    const lambdaRequestId = context.awsRequestId;

    console.log(
        `API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`
    );

    if(event.resource === '/products'){
        if(method === "GET"){

            const products = await getAllProducts();
                return {
                    statusCode: 200,
                    body: JSON.stringify(products),
                }
        }

        if(method === 'POST'){
            const product = JSON.parse(event.body!) as Product

            const createdProduct = await createProduct(product);
            const response = await sendProductEvent(createdProduct, ProductEventType.CREATED, 'matilde@inatel.br', apiRequestId);

            console.log(response);
            return {
                statusCode: 201,
                body: JSON.stringify(createdProduct),
            }; 
        }
    }
    
    if(event.resource === '/products/{id}'){
        const productId = event.pathParameters!.id as string;

        if(method === 'GET'){
            console.log(`GET /products/{id}`);

            try {
                const product = await getProductById(productId);

                return {
                    statusCode: 200,
                    body: JSON.stringify(product)
                }                
            } catch (error) {
                console.error((<Error>error).message)

                return {
                    statusCode: 404,
                    body: (<Error>error).message
                }
            }

        }

        if(method === 'DELETE'){
            console.log(`DELETE /products/${productId}`);

            try {
                const product = await deleteProductById(productId); 

                const response = await sendProductEvent(product, ProductEventType.DELETED, 'rafa@inatel.br', apiRequestId);

                console.log(response);

                return{
                    statusCode: 200,
                    body: JSON.stringify(product),
                }
            } catch (error) {
                console.error((<Error>error).message);

                return {
                    statusCode: 404,
                    body: (<Error>error).message,
                }
            }
        }
        
        if(method === 'PUT'){
            const product = JSON.parse(event.body!) as Product;
            
            try {
                const productUpdated = await updateProduct(productId, product);
                
                const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'jaqueline@inatel.br', apiRequestId);

                console.log(response);

                return { 
                    statusCode: 200, 
                    body: JSON.stringify(productUpdated)
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404, 
                    body: 'Product not found'
                }
            }
        }
    }

    return {
        statusCode: 400,
        headers: {},
        body: JSON.stringify({
        message: "Bad request",
        ApiGwRequestId: apiRequestId,
        LambdaRequestId: lambdaRequestId,
        }),
    };
}

function sendProductEvent(product: Product, eventType: ProductEventType, email: string, apiGwRequestId: string){
    const event: ProductEvent = {
        email: email,
        eventType: eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: apiGwRequestId,
    }

    lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: "RequestResponse",
    }).promise();
}

async function updateProduct(productId: string, product: Product) {
    const data = await ddbClient.update({
        TableName: productDdb,
        Key: {
            id: productId,
        },
        ConditionExpression: 'attribute_exists(id)',
        ReturnValues: 'UPDATED_NEW',
        UpdateExpression: 'set productName = :n, code = :c, price = :p, model = :m, productUrl = :u',
        ExpressionAttributeValues: {
            ':n': product.productName,
            ':c': product.code,
            ':p': product.price,
            ':m': product.model,
            ':u': product.productUrl,
        }
    }).promise();

    data.Attributes!.id = productId;
    return data.Attributes as Product;
}

async function createProduct(product: Product): Promise<Product> {
    product.id = uuid();
    ddbClient.put({
        TableName: productDdb,
        Item: product,    
    }).promise();

    return product;
}

async function deleteProductById(productId: string): Promise<Product> {
    const data = await ddbClient.delete({
        TableName: productDdb,
        Key: {
            id: productId,
        },
        ReturnValues: 'ALL_OLD',
    }).promise()

    if (data.Attributes)
        return data.Attributes as Product;
    else 
        throw new Error('Product nor found');
}

async function getProductById(productId: string) {
    const data = await ddbClient.get({
        TableName: productDdb,
        Key: {
            id: productId,
        }
    }).promise()

    if(data.Item)
        return data.Item as Product;
    else 
        throw new Error('Product not found');
}

async function getAllProducts(): Promise<Product[]> {
    // NAO FAÇA ISSO
    const data = await ddbClient.scan({
        TableName: 'products',
    }).promise()

    return data.Items as Product[];
}

