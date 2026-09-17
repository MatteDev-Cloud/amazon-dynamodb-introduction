import boto3
from boto3 import dynamodb

ddb = boto3.resource(
    "dynamodb",
    endpoint_url="http://localhost:8000",
    region_name="eu-south-1",
    aws_access_key_id="fake",
    aws_secret_access_key="fake",
)
client = ddb.meta.client  # low-level, serve per transazioni
#table = ddb.Table("Orders")

student = ddb.create_table(
    TableName="Students",
    KeySchema=[
        {"AttributeName": "student_id", "KeyType": "HASH"},
        {"AttributeName": "name", "KeyType": "RANGE"},
    ],
    AttributeDefinitions=[
        {"AttributeName": "student_id", "AttributeType": "N"},
        {"AttributeName": "name", "AttributeType": "S"}
    ],
    BillingMode="PAY_PER_REQUEST",
)


# ancora da fare e aveva dato errore
student.put_item(
    Item={1,"riccardo"}
)

