import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from "aws-cdk-lib/aws-iam"
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventsSource from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

interface OrdersApplicationStackProps extends cdk.StackProps {
    productsDdb: dynamodb.Table,
    eventsDdb: dynamodb.Table,
}

export class OrdersApplicationStack extends cdk.Stack {
    readonly ordersHandler : lambdaNodeJS.NodejsFunction;

    constructor(scope: Construct, id: string, props: OrdersApplicationStackProps){
        super(scope, id, props);

        const ordersTopic = new sns.Topic(this, 'OrderEventsTopic', {
            displayName: 'Order events topic',
            topicName: 'order-events',
        })

        //TODO - to be removed
        ordersTopic.addSubscription(new subs.EmailSubscription('adrianoeduardotrentin@hotmail.com', {
            json: true,
        }))

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

        const redScale = ordersDdb.autoScaleReadCapacity({
            maxCapacity: 4,
            minCapacity: 1,
        });

        redScale.scaleOnUtilization({
            targetUtilizationPercent: 10,
            scaleInCooldown: cdk.Duration.seconds(60),
            scaleOutCooldown: cdk.Duration.seconds(60),
        })

        const writeScale = ordersDdb.autoScaleWriteCapacity({
            maxCapacity: 4,
            minCapacity: 1
        });

        writeScale.scaleOnUtilization({
            targetUtilizationPercent: 10,
            scaleInCooldown: cdk.Duration.seconds(60),
            scaleOutCooldown: cdk.Duration.seconds(60),
        })

        this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, 'OrdersFunction', {
            functionName: 'OrdersFunction',
            entry: "lambda/orders/ordersFunction.ts",
            handler: 'handler',
            runtime: lambda.Runtime.NODEJS_16_X,
            bundling: {
                minify: true,
                sourceMap: false,
            },
            environment: {
                PRODUCTS_DDB: props.productsDdb.tableName,
                ORDERS_DDB: ordersDdb.tableName,
                ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn,
            },
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
            timeout: cdk.Duration.seconds(10)
        })
        props.productsDdb.grantReadData(this.ordersHandler);
        ordersDdb.grantReadWriteData(this.ordersHandler);
        ordersTopic.grantPublish(this.ordersHandler);

        const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEventsFunction', {
            functionName: 'OrderEventsFunction',
            entry: 'lambda/orders/orderEventsFunctions.ts',
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
            timeout: cdk.Duration.seconds(10),
        });

        ordersTopic.addSubscription(new subs.LambdaSubscription(orderEventsHandler));

        const eventsDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [props.eventsDdb.tableArn],
            conditions:  {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeandingKeys': ['#order_*']
                }
            }
        })
        
        orderEventsHandler.addToRolePolicy(eventsDdbPolicy);

        const billingHandler = new lambdaNodeJS.NodejsFunction(this, 'BillingFunction', {
            functionName: 'BillingFunction',
            entry: 'lambda/orders/billingEventsFunction.ts',
            handler: 'handler',
            bundling: {
                minify: true,
                sourceMap: false,
            },
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
            timeout: cdk.Duration.seconds(10),
        });
        
        ordersTopic.addSubscription(new subs.LambdaSubscription(billingHandler, {
            filterPolicy: {
                eventType: sns.SubscriptionFilter.stringFilter({
                    allowlist:['CREATED']
                })
            }
        }));

        const orderEventsDlq = new sqs.Queue(this, 'OrderEventsDlq', {
            queueName: 'order-events-dlq',
            enforceSSL: false,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
        });

        const orderEventsQueue = new sqs.Queue(this, 'OrderEventsQueue', {
            queueName: 'order-events',
            enforceSSL: false,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            deadLetterQueue: {
                queue: orderEventsDlq,
                maxReceiveCount: 3,
            }
        });

        ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueue));

        const orderEmailsHandler = new lambdaNodeJS.NodejsFunction(this, 'OrderEmailsFunction', {
            functionName: 'OrderEmailsFunction',
            entry: 'lambda/orders/orderEmailsFunction.ts',
            handler: 'handler',
            bundling: {
                minify: true,
                sourceMap: false,
            },
            memorySize: 128,
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_143_0,
            timeout: cdk.Duration.seconds(10),
        });

        orderEmailsHandler.addEventSource(new lambdaEventsSource.SqsEventSource(orderEventsQueue));
        orderEventsQueue.grantConsumeMessages(orderEmailsHandler);
    }
}