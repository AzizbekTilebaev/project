#!/bin/bash

echo "🚀 Setting up Qaraqalpaq Til Platforması Backend..."
echo ""

# Ensure .env file exists
echo "📝 Checking .env file..."
node scripts/ensure-env.js

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Generate Prisma Client
echo "1️⃣ Generating Prisma Client..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Failed to generate Prisma Client"
    exit 1
fi
echo "✅ Prisma Client generated"
echo ""

# Run migrations
echo "2️⃣ Running database migrations..."
npx prisma migrate dev --name init
if [ $? -ne 0 ]; then
    echo "❌ Failed to run migrations"
    exit 1
fi
echo "✅ Migrations completed"
echo ""

# Seed database
echo "3️⃣ Seeding database..."
node prisma/seed.js
if [ $? -ne 0 ]; then
    echo "❌ Failed to seed database"
    exit 1
fi
echo "✅ Database seeded"
echo ""

echo "🎉 Setup completed successfully!"
echo ""
echo "📝 Test credentials:"
echo "   Admin: admin@qaraqalpaq.uz / admin123"
echo "   User: user@test.uz / user123"
echo ""
echo "🚀 Start server with: npm run dev"



