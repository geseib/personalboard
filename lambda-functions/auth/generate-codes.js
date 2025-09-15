import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE;

// Generate 6-digit numeric code
function makeCode() {
  // Generate a random 6-digit number between 100000 and 999999
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const handler = async (event) => {
  const { count = 100, notes = "Personal Board Access" } = event || {};
  const made = [];
  
  for (let i = 0; i < count; i++) {
    const code = makeCode();
    try {
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: { 
          code, 
          status: "AVAILABLE", 
          notes,
          createdAt: Math.floor(Date.now() / 1000)
        },
        ConditionExpression: "attribute_not_exists(code)"
      }));
      made.push(code);
    } catch (e) {
      // collision: retry
      i--;
    }
  }
  
  return { 
    created: made.length, 
    codes: made,
    notes
  };
};