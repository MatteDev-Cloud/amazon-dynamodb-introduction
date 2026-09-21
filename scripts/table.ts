import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, UpdateTimeToLiveCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
export async function ensureTable(client:DynamoDBClient,tableName:string) {
  try { await client.send(new DescribeTableCommand({TableName:tableName})); return; }
  catch(e) { if(!(e instanceof Error)||e.name!=='ResourceNotFoundException') throw e; }
  await client.send(new CreateTableCommand({TableName:tableName,BillingMode:'PAY_PER_REQUEST',
    AttributeDefinitions:[{AttributeName:'PK',AttributeType:'S'},{AttributeName:'SK',AttributeType:'S'},{AttributeName:'cv',AttributeType:'S'},{AttributeName:'updatedAt',AttributeType:'N'},{AttributeName:'lb',AttributeType:'S'},{AttributeName:'score',AttributeType:'N'}],
    KeySchema:[{AttributeName:'PK',KeyType:'HASH'},{AttributeName:'SK',KeyType:'RANGE'}],
    GlobalSecondaryIndexes:[
      {IndexName:'ByTime',KeySchema:[{AttributeName:'cv',KeyType:'HASH'},{AttributeName:'updatedAt',KeyType:'RANGE'}],Projection:{ProjectionType:'INCLUDE',NonKeyAttributes:['x','y','color','by','deleted','expiresAt']}},
      {IndexName:'ByScore',KeySchema:[{AttributeName:'lb',KeyType:'HASH'},{AttributeName:'score',KeyType:'RANGE'}],Projection:{ProjectionType:'INCLUDE',NonKeyAttributes:['nickname','team','pid','joinedAt','expiresAt','roundId']}},
    ]}));
  await waitUntilTableExists({client,maxWaitTime:30,minDelay:1,maxDelay:2},{TableName:tableName});
  await client.send(new UpdateTimeToLiveCommand({TableName:tableName,TimeToLiveSpecification:{AttributeName:'expiresAt',Enabled:true}}));
}
