import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface OrdersApplicationStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table
}

export class OrdersApplicationStack extends cdk.Stack {
    readonly ordersHandler : lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: OrdersApplicationStackProps){
        super(scope, id, props);

        const ordersDdb = new dynamodb.Table(this, 'OrdersDdb', {
            tableName: 'Orders',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
            partitionKey: {
                name: 'pk',
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: 'sk',
                type: dynamodb.AttributeType.STRING,
            }
        });

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, 'OrdersFunction', {
            functionName: 'OrdersFunction',
            entry: "lambda/orders/ordersFunction.ts",
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: props.productsDdb.tableName,
                ORDERS_DDB: ordersDdb.tableName
            },
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
            timeout: cdk.Duration.seconds(10)
        })

        props.productsDdb.grantReadData(this.ordersHandler);
        ordersDdb.grantReadWriteData(this.ordersHandler);
    }
}