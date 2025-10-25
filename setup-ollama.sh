#!/bin/bash

# 🦙 Ollama Setup Script for CareNotes Copilot
# This script sets up everything you need to run the app locally with FREE AI

set -e

echo "🦙 Setting up Ollama for CareNotes Copilot..."
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo ""
    echo "📦 Install Ollama:"
    echo "  macOS:   brew install ollama"
    echo "  Linux:   curl -fsSL https://ollama.com/install.sh | sh"
    echo "  Windows: https://ollama.com/download/windows"
    echo ""
    exit 1
fi

echo "✅ Ollama is installed"

# Check if Ollama is running
if ! curl -s http://localhost:11434 > /dev/null 2>&1; then
    echo "⚠️  Ollama server is not running"
    echo "🚀 Starting Ollama in the background..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
fi

echo "✅ Ollama server is running"

# Check if model is downloaded
if ! ollama list | grep -q "llama3.2"; then
    echo "📥 Downloading llama3.2 model (this will take a few minutes)..."
    ollama pull llama3.2
else
    echo "✅ llama3.2 model is ready"
fi

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << 'EOF'
# AI Provider - Using FREE Ollama
USE_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Database (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carenotes

# Redis (Docker)
REDIS_URL=redis://localhost:6379

# Auth Secret (change this!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-please-change-this

# Optional: Observability
# LANGFUSE_PUBLIC_KEY=
# LANGFUSE_SECRET_KEY=
# SENTRY_DSN=
EOF
    echo "✅ .env.local created"
else
    echo "✅ .env.local already exists"
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "✅ Docker is running"

echo ""
echo "🎉 Setup complete! Now run:"
echo ""
echo "  npm run setup    # Start DB, Redis, and seed data"
echo "  npm run dev      # Start the app"
echo ""
echo "Then visit: http://localhost:3000"
echo ""
echo "💡 Test the API:"
echo '  curl -X POST http://localhost:3000/api/ask \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '"'"'{"question": "What symptoms does the patient have?"}'"'"
echo ""

