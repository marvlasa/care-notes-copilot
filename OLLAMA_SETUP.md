# 🦙 Ollama Setup Guide - Free Local AI

Run AI models on your machine for **FREE** - no API keys, no costs, no limits!

## 📦 Installation

### macOS
```bash
brew install ollama
```

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
Download from: https://ollama.com/download/windows

## 🚀 Quick Start

### 1. Start Ollama Server
```bash
ollama serve
```

Leave this running in a terminal.

### 2. Download a Model
```bash
# Recommended: Fast and good quality (2GB)
ollama pull llama3.2

# Alternative options:
ollama pull mistral      # 4GB - Great for code
ollama pull phi3         # 2GB - Fast, Microsoft model
ollama pull codellama    # 7GB - Specialized for code
```

### 3. Configure Your App
```bash
# Copy example config
cp .env.local.example .env.local

# Edit .env.local and ensure these lines are set:
USE_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### 4. Start Your App
```bash
# Start local services
npm run db:up

# Initialize database
npm run db:init
npm run db:seed

# Start Next.js
npm run dev
```

### 5. Test It!
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What symptoms does the patient have?"}'
```

## 📊 Model Comparison

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **llama3.2** | 2GB | ⚡⚡⚡ | ⭐⭐⭐ | General (Recommended) |
| **mistral** | 4GB | ⚡⚡ | ⭐⭐⭐⭐ | Complex queries |
| **phi3** | 2GB | ⚡⚡⚡ | ⭐⭐⭐ | Fast responses |
| **codellama** | 7GB | ⚡ | ⭐⭐⭐⭐ | Code generation |

## 🔧 Troubleshooting

### "Connection refused"
```bash
# Check if Ollama is running
curl http://localhost:11434

# If not, start it:
ollama serve
```

### "Model not found"
```bash
# Pull the model first
ollama pull llama3.2

# List installed models
ollama list
```

### Slow responses?
```bash
# Use a smaller/faster model
ollama pull phi3

# Update .env.local:
OLLAMA_MODEL=phi3
```

## 🎯 Switch Between Ollama and OpenAI

### Use Ollama (Free)
```bash
USE_OLLAMA=true
```

### Use OpenAI (Paid)
```bash
USE_OLLAMA=false
OPENAI_API_KEY=sk-...
```

No code changes needed! The app automatically uses the right provider.

## 💡 Tips

1. **First request is slower** - Ollama loads the model into memory
2. **Keep Ollama running** - It's a background service
3. **Try different models** - Each has different strengths
4. **Models persist** - Once downloaded, they're on your disk forever

## 📈 Performance

On a modern laptop (M1/M2 Mac or recent Intel):
- **Model load time**: 2-5 seconds (first request only)
- **Response time**: 1-3 seconds for typical queries
- **Memory usage**: 2-8GB depending on model

## 🆚 Ollama vs OpenAI

| Feature | Ollama | OpenAI |
|---------|--------|--------|
| Cost | FREE | Pay per token |
| Speed | Good (local) | Excellent |
| Quality | Good | Excellent |
| Privacy | 100% local | Data sent to OpenAI |
| Offline | ✅ Works | ❌ Requires internet |
| Setup | 5 minutes | 1 minute |

## 🎉 You're Ready!

Your app now runs 100% free locally with:
- ✅ Free AI (Ollama)
- ✅ Free Database (Docker PostgreSQL)
- ✅ Free Cache (Docker Redis)
- ✅ No API keys needed
- ✅ No usage limits

Happy coding! 🚀

