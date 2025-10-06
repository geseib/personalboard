#!/bin/bash

# Script to copy prompts from production to board.dev environment

export AWS_PROFILE=adminaccess

echo "📋 Copying prompts from production to board.dev environment..."

# Source and target tables
SOURCE_TABLE="personal-board-prompt-management"
TARGET_TABLE="personal-board-boarddev-prompt-management"

# Step 1: Export prompts from production
echo "1️⃣ Exporting prompts from production..."
aws dynamodb scan \
    --table-name $SOURCE_TABLE \
    --output json > /tmp/prod-prompts.json

# Step 2: Filter for ADVISOR and PROMPT items
echo "2️⃣ Filtering advisor and prompt configurations..."
cat /tmp/prod-prompts.json | jq '.Items[] | select(.PK.S | startswith("ADVISOR#") or startswith("PROMPT#"))' | jq -s '.' > /tmp/filtered-prompts.json

PROMPT_COUNT=$(cat /tmp/filtered-prompts.json | jq '. | length')
echo "   Found $PROMPT_COUNT prompts to copy"

# Step 3: Split into batches of 25 items (DynamoDB limit)
echo "3️⃣ Splitting into batches (25 items max per batch)..."
BATCH_SIZE=25
TOTAL_BATCHES=$(( ($PROMPT_COUNT + $BATCH_SIZE - 1) / $BATCH_SIZE ))
echo "   Will process $TOTAL_BATCHES batch(es)"

# Step 4: Process each batch
SUCCESS_COUNT=0
for ((i=0; i<$TOTAL_BATCHES; i++)); do
    START=$(($i * $BATCH_SIZE))
    END=$(( ($i + 1) * $BATCH_SIZE ))

    echo "4️⃣ Processing batch $(($i + 1))/$TOTAL_BATCHES (items $START to $END)..."

    # Create batch for current set of items
    cat /tmp/filtered-prompts.json | jq --argjson start $START --argjson size $BATCH_SIZE '{
      "'$TARGET_TABLE'": [
        .[$start:($start + $size)] | .[] | {
          "PutRequest": {
            "Item": .
          }
        }
      ]
    }' > /tmp/boarddev-batch-$i.json

    # Write batch to DynamoDB
    aws dynamodb batch-write-item \
        --request-items file:///tmp/boarddev-batch-$i.json

    if [ $? -eq 0 ]; then
        BATCH_ITEMS=$(cat /tmp/boarddev-batch-$i.json | jq '."'$TARGET_TABLE'" | length')
        SUCCESS_COUNT=$((SUCCESS_COUNT + BATCH_ITEMS))
        echo "   ✅ Batch $(($i + 1)) completed: $BATCH_ITEMS items written"
    else
        echo "   ❌ Batch $(($i + 1)) failed"
    fi
done

if [ $SUCCESS_COUNT -eq $PROMPT_COUNT ]; then
    echo ""
    echo "✅ Successfully copied all $PROMPT_COUNT prompts to board.dev environment!"
    echo ""
    echo "📊 Summary:"
    echo "   Source: $SOURCE_TABLE"
    echo "   Target: $TARGET_TABLE"
    echo "   Items copied: $SUCCESS_COUNT"
    echo "   Batches processed: $TOTAL_BATCHES"
else
    echo ""
    echo "⚠️  Partial success: $SUCCESS_COUNT of $PROMPT_COUNT prompts copied"
    exit 1
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Visit https://board.dev.seibtribe.us/admin.html"
echo "   2. Verify prompts are loaded correctly"
echo "   3. Activate desired prompts for each category"