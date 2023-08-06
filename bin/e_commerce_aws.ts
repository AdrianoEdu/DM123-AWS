#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductAppStack } from '../lib/stacks/productApp-stack';
import { ECommerceApiStack } from '../lib/stacks/ecommerceApi-stack';
import { ProductEventsFunctionStack } from '../lib/stacks/productEventsFunction-stack';
import { EventsDdbStack } from '../lib/stacks/eventsDdb-stack';

const app = new cdk.App();

const tags = {
  cost: 'ECommerce',
  team: 'Inatel'
}

const env : cdk.Environment = {
  account: '756459249580',
  region: 'us-east-2'
}

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdb', {
  env: env,
  tags: tags,
})

const productEventsFunctionStack = new ProductEventsFunctionStack(app, 'ProductEventsFunction', {
  eventsDdb: eventsDdbStack.table,
  env: env,
  tags: tags,
});

const productsAppStack = new ProductAppStack(app, "ProductsAppStore", {
  tags: tags,
  env: env,
  productEventsFunction: productEventsFunctionStack.handler,
});

productsAppStack.addDependency(productEventsFunctionStack);

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApiRest", {
  productsHandler: productsAppStack.handler,
  tags: tags,
  env: env
});

eCommerceApiStack.addDependency(productsAppStack)
