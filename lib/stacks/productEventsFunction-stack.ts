import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs';

interface ProductEventsFunctionStackProps extends cdk.StackProps {
    eventsDdb: dynamodb.Table
}

export class ProductEventsFunctionStack extends cdk.Stack {
    readonly handler: lambdaNodeJS.NodejsFunction;
    
    constructor(scope: Construct, id: string, props: ProductEventsFunctionStackProps){
        super(scope, id, props);

        this.handler = new lambdaNodeJS.NodejsFunction(this, 'ProductEventsFunction', {
            functionName: 'ProductEventsFunction',
            entry: 'lambda/products/productEventsFunction.ts',
            handler: 'handler',
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName,
            },
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
            timeout: cdk.Duration.seconds(30),
        });

        props.eventsDdb.grantReadWriteData(this.handler);
    }
}