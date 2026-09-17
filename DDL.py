"""
DDL.py
------
Script di esplorazione di Amazon DynamoDB (locale, via Docker) applicato a un
dominio "scuola" semplificato. Copre: creazione tabelle, put_item con
ConditionExpression, get_item, query su PK+SK, creazione di un Global
Secondary Index (GASI/GSI) e query sull'indice.

Prerequisiti:
    - DynamoDB Local in esecuzione (vedi README.md per il comando docker)
    - boto3 installato (pip install boto3)

Esecuzione:
    python DDL.py
    (i blocchi di create_table sono commentati per evitare errori se le
    tabelle esistono già: scommentare solo per un setup da zero)
"""

import random
import boto3
from boto3.dynamodb.conditions import Key, Attr


# ---------------------------------------------------------------------------
# CONNESSIONE
# ---------------------------------------------------------------------------
# Le credenziali sono fittizie: DynamoDB Local non fa autenticazione reale,
# ma boto3 richiede comunque questi parametri per costruire la richiesta.
# NB: DynamoDB Local, senza il flag -sharedDb sul container, isola i dati
# per combinazione di (access_key, region) -> con -sharedDb tutte le
# connessioni (script Python, NoSQL Workbench, ecc.) vedono lo stesso storage.
ddb = boto3.resource(
    "dynamodb",
    endpoint_url="http://localhost:8000",
    region_name="eu-south-1",
    aws_access_key_id="fake",
    aws_secret_access_key="fake",
)


# ---------------------------------------------------------------------------
# TABELLA "studenti"
# ---------------------------------------------------------------------------
# Access pattern coperto: "dato l'id, ottieni lo studente" -> nessuna query
# di range necessaria all'interno della stessa partizione, quindi PK
# semplice (solo HASH), senza Sort Key.
#
# NB: AttributeDefinitions dichiara SOLO gli attributi usati come chiave
# (qui: id). Gli altri campi dell'item (name, email, ...) sono liberi:
# DynamoDB è schemaless su tutto ciò che non è chiave/indice.

# studenti_table = ddb.create_table(
#     TableName="studenti",
#     KeySchema=[
#         {"AttributeName": "id", "KeyType": "HASH"},
#     ],
#     AttributeDefinitions=[
#         {"AttributeName": "id", "AttributeType": "S"},
#     ],
#     BillingMode="PAY_PER_REQUEST",  # niente da dimensionare per un progetto di test
# )

studenti_table = ddb.Table("studenti")

# Popolamento con 10 studenti di esempio.
# for x in range(10):
#     studenti_table.put_item(
#         Item={
#             "id": f"{x}",
#             "name": f"student_{x}",
#             "email": f"student_{x}@example.com",
#         }
#     )

# Variante con ConditionExpression: impedisce che un put_item successivo
# sovrascriva silenziosamente uno studente già esistente con la stessa PK
# (DynamoDB di default fa upsert su put_item -> stessa chiave = sovrascrittura).
# La condizione è valutata atomicamente lato server (niente race condition).
#
# studenti_table.put_item(
#     Item={"id": "1", "name": "student_1", "email": "student_1@example.com"},
#     ConditionExpression="attribute_not_exists(id)",
# )


# ---------------------------------------------------------------------------
# TABELLA "iscrizioni"
# ---------------------------------------------------------------------------
# Relazione molti-a-molti studenti <-> corsi. Access pattern coperto qui:
# "dato un corso, elenca tutti gli studenti iscritti" -> serve una query
# (non un get_item) che ritorni PIÙ item per la stessa partizione, quindi:
#   PK = course_id, SK = student_id
# La coppia (course_id, student_id) è la vera chiave primaria: item con lo
# stesso corso ma studente diverso convivono, ordinati per student_id.

# Ricreazione pulita della tabella (utile in fase di sviluppo/test).
# delete() è asincrono: bisogna attendere lo stato "not exists" prima di
# poter ricreare una tabella con lo stesso nome, altrimenti si rischia
# ResourceInUseException.
# if ddb.Table("iscrizioni") in ddb.tables.all():
#     ddb.Table("iscrizioni").delete()
#     ddb.meta.client.get_waiter("table_not_exists").wait(TableName="iscrizioni")

# iscrizioni_table = ddb.create_table(
#     TableName="iscrizioni",
#     KeySchema=[
#         {"AttributeName": "course_id", "KeyType": "HASH"},
#         {"AttributeName": "student_id", "KeyType": "RANGE"},
#     ],
#     AttributeDefinitions=[
#         {"AttributeName": "course_id", "AttributeType": "S"},
#         {"AttributeName": "student_id", "AttributeType": "S"},
#     ],
#     BillingMode="PAY_PER_REQUEST",
# )

iscrizioni_table = ddb.Table("iscrizioni")

# Popolamento con 10 iscrizioni random.
# NB: course_id e student_id sono generati random e indipendenti -> possibili
# collisioni sulla stessa coppia (PK+SK), che causerebbero una sovrascrittura
# silenziosa (upsert) invece di un errore.
# for x in range(10):
#     iscrizioni_table.put_item(
#         Item={
#             "course_id": f"course_{random.randint(1, 10)}",
#             "student_id": f"{random.randint(1, 10)}",
#             "mark": f"{random.randint(0, 30)}",  # salvato come stringa (tipo S)
#         }
#     )


# ---------------------------------------------------------------------------
# LETTURA: get_item vs query
# ---------------------------------------------------------------------------
# get_item: recupero puntuale per chiave completa (qui solo PK, "studenti"
# non ha SK) -> un solo item, o nessuno. Risposta in response["Item"] (singolare).
print(f"get_item: {studenti_table.get_item(Key={'id': '1'})['Item']}")

# query: recupero di uno o più item che condividono la stessa PK.
# KeyConditionExpression lavora SOLO su PK/SK (mai su attributi generici).
# Condizioni multiple su PK+SK si compongono con l'operatore & (mai "and"
# nativo di Python: con oggetti Condition di boto3, "and" scarterebbe
# silenziosamente uno dei due operandi). Risposta in response["Items"] (plurale).
print(
    "query: "
    f"{iscrizioni_table.query(KeyConditionExpression=Key('course_id').eq('course_10') & Key('student_id').eq('10'))['Items']}"
)

# FilterExpression (per confronto): filtra su un attributo NON di chiave
# (qui "mark"), ma solo DOPO aver letto tutti gli item della KeyCondition
# (o dell'intera tabella, se usato dentro uno scan) -> si paga comunque la
# lettura di tutto ciò che viene scartato. Usare Attr (non Key) per attributi
# generici. Esempio (richiede comunque una KeyConditionExpression sulla PK,
# quindi qui è solo illustrativo su una singola partizione):
#
# print(
#     iscrizioni_table.query(
#         KeyConditionExpression=Key("course_id").eq("course_1"),
#         FilterExpression=Attr("mark").eq("28"),
#     )["Items"]
# )


# ---------------------------------------------------------------------------
# GLOBAL SECONDARY INDEX (GASI): query per "mark" su tutta la tabella
# ---------------------------------------------------------------------------
# Access pattern non supportato dalla PK/SK base di "iscrizioni": "trova tutte
# le iscrizioni con un certo voto". Serve un indice con una PK diversa.
#
# Aggiunta a una tabella ESISTENTE -> update_table (via .update()), non
# create_table. Differenze rispetto a un GSI dichiarato in create_table:
#   - AttributeDefinitions va ripetuto, ma SOLO con l'attributo nuovo (mark)
#   - il parametro è GlobalSecondaryIndexUpdates (lista), con l'azione
#     esplicita "Create" (lo stesso parametro serve anche per Update/Delete)
#   - la creazione è asincrona: l'indice passa per lo stato CREATING mentre
#     DynamoDB fa il backfill; va verificato IndexStatus == "ACTIVE" prima
#     di fidarsi dei risultati (vedi describe_table sotto)
#
# Nessuna Sort Key necessaria: una query per sola PK (mark) ritorna già tutti
# gli item con quel valore, non serve un ulteriore ordinamento interno.
# Projection ALL: gli unici altri attributi (course_id, student_id) sono già
# chiavi della tabella base e sarebbero comunque inclusi -> KEYS_ONLY
# sarebbe equivalente qui, ALL lasciato per semplicità.

# ddb.Table("iscrizioni").update(
#     AttributeDefinitions=[
#         {"AttributeName": "mark", "AttributeType": "S"},
#     ],
#     GlobalSecondaryIndexUpdates=[
#         {
#             "Create": {
#                 "IndexName": "mark-index",
#                 "KeySchema": [
#                     {"AttributeName": "mark", "KeyType": "HASH"},
#                 ],
#                 "Projection": {"ProjectionType": "ALL"},
#             }
#         }
#     ],
# )

# Verifica dello stato dell'indice prima di interrogarlo (deve essere ACTIVE).
# print(ddb.meta.client.describe_table(TableName="iscrizioni")["Table"]["GlobalSecondaryIndexes"])

# Query sul GASI: si aggiunge IndexName alla query, la sintassi della
# KeyConditionExpression resta identica a una query sulla tabella base.
# Attenzione al tipo: mark è salvato come stringa ("S"), quindi va confrontato
# con "28" (stringa), non 28 (int) -> tipi diversi non sono coercibili.
voti_28 = [
    x["student_id"]
    for x in iscrizioni_table.query(
        IndexName="mark-index",
        KeyConditionExpression=Key("mark").eq("28"),
    )["Items"]
]
print(f"voto 28: {voti_28}")
