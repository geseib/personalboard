import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE;

const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1

function makeCode(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += ABC[Math.floor(Math.random() * ABC.length)];
  return s;
}

export const handler = async (event) => {
  const { count = 100, prefix = "", length = 8, notes = "" } = event || {};
  const made = [];
  for (let i = 0; i < count; i++) {
    const code = `${prefix}${makeCode(length)}`;
    try {
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { code, status: "AVAILABLE", notes },
        ConditionExpression: "attribute_not_exists(code)"
      }));
      made.push(code);
    } catch (e) {
      // collision: retry
      i--;
    }
  }
  return { created: made.length, codes: made };
};
