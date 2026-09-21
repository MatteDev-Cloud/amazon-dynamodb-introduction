import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('.local/prices',{recursive:true});
for (const service of ['AmazonDynamoDB','AmazonApiGateway','AWSLambda']) {
  const source=`https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/${service}/current/eu-central-1/index.json`;
  const response=await fetch(source);if(!response.ok)throw Error(`${service}: ${response.status}`);
  const data=await response.json();
  const matches=[];
  for(const [sku,p] of Object.entries(data.products)) {
    const attributes=p.attributes;
    if(service==='AmazonDynamoDB' && (!['DDB-WriteUnits','DDB-ReadUnits'].includes(attributes.group)||attributes.operation!=='PayPerRequestThroughput'))continue;
    if(service==='AmazonApiGateway' && attributes.operation!=='ApiGatewayHttpApi')continue;
    if(service==='AWSLambda' && !['EUC1-Lambda-GB-Second-ARM','EUC1-Request-ARM'].includes(attributes.usagetype))continue;
    const terms=Object.values(data.terms.OnDemand[sku]??{});
    matches.push({sku,attributes,terms});
  }
  const snapshot={source,publicationDate:data.publicationDate,retrievedAt:new Date().toISOString(),matches};
  await writeFile(`.local/prices/${service}.json`,JSON.stringify(snapshot,null,2));
  console.log(service, JSON.stringify(matches.map(m=>({sku:m.sku,usage:m.attributes.usagetype,terms:m.terms}))));
}
