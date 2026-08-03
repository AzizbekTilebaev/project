# PowerShell setup script for Windows

Write-Host "🚀 Setting up Qaraqalpaq Til Platforması Backend..." -ForegroundColor Cyan
Write-Host ""

# Ensure .env file exists
Write-Host "📝 Checking .env file..." -ForegroundColor Yellow
node scripts/ensure-env.js

# Load environment variables from .env
$envContent = Get-Content .env | Where-Object { $_ -match '^[^#]' }
foreach ($line in $envContent) {
    if ($line -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Generate Prisma Client
Write-Host "1️⃣ Generating Prisma Client..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma Client" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Prisma Client generated" -ForegroundColor Green
Write-Host ""

# Run migrations
Write-Host "2️⃣ Running database migrations..." -ForegroundColor Yellow
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to run migrations" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migrations completed" -ForegroundColor Green
Write-Host ""

# Seed database
Write-Host "3️⃣ Seeding database..." -ForegroundColor Yellow
node prisma/seed.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database seeded" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Test credentials:" -ForegroundColor Cyan
Write-Host "   Admin: admin@qaraqalpaq.uz / admin123"
Write-Host "   User: user@test.uz / user123"
Write-Host ""
Write-Host "🚀 Start server with: npm run dev" -ForegroundColor Cyan



