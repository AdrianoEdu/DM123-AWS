#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductAppStack } from '../lib/stacks/productApp-stack';
import { ECommerceApiStack } from '../lib/stacks/ecommerceApi-stack';

const app = new cdk.App();

const tags = {
  cost: 'ECommerce',
  team: 'Inatel'
}

const env : cdk.Environment = {
  account: '756459249580',
  region: 'us-east-2'
}

const productsAppStack = new ProductAppStack(app, "ProductsAppStore", {
  tags: tags,
  env: env
});

const eCommerceApiStack = new ECommerceApiStack(app, "ECommerceApiRest", {
  productsHandler: productsAppStack.handler,
  tags: tags,
  env: env
});

eCommerceApiStack.addDependency(productsAppStack)