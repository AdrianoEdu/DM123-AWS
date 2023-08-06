import * as cdk from 'aws-cdk-lib';
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import { Construct } from 'constructs';
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"

interface ECommerceApiStackProps extends cdk.StackProps {
    productsHandler: lambdaNodeJS.NodejsFunction
    ordersHandler: lambdaNodeJS.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack {
    public readonly urlOutput: cdk.CfnOutput;

    constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
        super(scope, id, props);

        const logGroup = new cwlogs.LogGroup(this, "ECommerceApiLogs");
        const api = new apigateway.RestApi(this, 'ecommerce-api', {
            restApiName: 'ECommerce Service',
            description: 'This is the Ecommerce Service',
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                caller: true,
                httpMethod: true,
                ip: true,
                protocol: true,
                requestTime: true,
                resourcePath: true,
                responseLength: true,
                status: true,
                user: true,
                }),
            }
        });

        const productsFunctionIntegration = new apigateway.LambdaIntegration(props.productsHandler);
        //produtcs
        const productsResource = api.root.addResource('products');

        //GET http://...../products
        productsResource.addMethod('GET', productsFunctionIntegration);

        // //POST http://...../products
        productsResource.addMethod('POST', productsFunctionIntegration);

        const productIdResource = productsResource.addResource('{id}');
        
        //GET http://...../products/{id}
        productIdResource.addMethod("GET", productsFunctionIntegration);

        // //PUT http://...../products/{id}
        productIdResource.addMethod('PUT', productsFunctionIntegration);

        // //DELETE http://...../products/{id}
        productIdResource.addMethod('DELETE', productsFunctionIntegration);
        
        const ordersFunctionIntegration = new apigateway.LambdaIntegration(props.ordersHandler);
        const ordersResource = api.root.addResource('orders');

        ordersResource.addMethod("GET", ordersFunctionIntegration);

        ordersResource.addMethod("DELETE", ordersFunctionIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true,
            },
            requestValidatorOptions: {
                validateRequestParameters: true,
                requestValidatorName: 'Email and OrderId parameters validator'
            }
        });

        const orderRequestValidator = new apigateway.RequestValidator(this, 'OrderRequestValidator', {
            restApi: api,
            requestValidatorName: 'Order request validator',
            validateRequestBody: true,
        })

        const orderModel = new apigateway.Model(this, "OrderModel", {
            modelName: 'OrderModel',
            restApi: api,
            contentType: 'application/json',
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: {
                        type: apigateway.JsonSchemaType.STRING
                    },
                    productIds: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: {
                            type: apigateway.JsonSchemaType.STRING
                        }
                    },
                    payment: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ['CASH', 'DEBIT_CARD', 'CREDIT_CARD'],
                    }
                },
                required: ['email', 'productIds', 'payment'],
            },
        })

        ordersResource.addMethod("POST", ordersFunctionIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: {
                'application/json': orderModel,
            }
        });

        this.urlOutput = new cdk.CfnOutput(this, 'url', {
            exportName: 'url',
            value: api.url,
        })
    }
}