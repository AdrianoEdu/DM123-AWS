import * as cdk from 'aws-cdk-lib';
import * as lambdaNodeJS from "aws-cdk-lib/aws-lambda-nodejs"
import { Construct } from 'constructs';
import * as apigateway from "aws-cdk-lib/aws-apigateway"
import * as cwlogs from "aws-cdk-lib/aws-logs"

interface ECommerceApiStackProps extends cdk.StackProps {
    productsHandler: lambdaNodeJS.NodejsFunction
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
        
        this.urlOutput = new cdk.CfnOutput(this, 'url', {
            exportName: 'url',
            value: api.url,
        })
    }
}