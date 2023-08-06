import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface ProductAppStackProps extends cdk.StackProps {
    productEventsFunction: lambdaNodeJS.NodejsFunction;
}

export class ProductAppStack extends cdk.Stack {
    readonly handler: lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: ProductAppStackProps) {
        super(scope, id, props);

        const productsDdb = new dynamodb.Table(this, 'ProductsDdb', {
            tableName: 'products',
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
            removalPolicy: cdk.RemovalPolicy.DESTROY,            
        })

        this.handler = new lambdaNodeJS.NodejsFunction(this, 'ProductsFunctionAWS', {
            functionName: 'ProductsFunctionAWS',
            entry: 'lambda/products/productsFunction.ts',
            handler: 'handler',
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: productsDdb.tableName,
                PRODUCT_EVENTS_FUNCTION_NAME: props.productEventsFunction.functionName,
            },
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
            timeout: cdk.Duration.seconds(30),
        });

        productsDdb.grantReadWriteData(this.handler);
        props.productEventsFunction.grantInvoke(this.handler);
    }
}