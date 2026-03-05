# Zano Sheets Provider Guide

## All Available Providers

The app uses the `@mariozechner/pi-ai` library which supports the following providers:

---

## ✅ Recommended for Production (Browser-Safe)

These providers work perfectly in the Excel add-in (browser environment):

### 1. **Anthropic** (Claude)
- **Models**: Claude 3.5/3.7/4 Sonnet, Claude 3.5/4/4.5 Haiku, Claude Opus 4/4.5
- **API Type**: `anthropic-messages`
- **Auth**: API Key or OAuth (for Pro/Max subscriptions)
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes (Claude 3.7+, Claude 4+)
- **Pricing**: $3-15/million input tokens, $15-75/million output tokens
- **Get API Key**: https://console.anthropic.com/settings/keys

### 2. **OpenAI**
- **Models**: GPT-4o, GPT-4.1, GPT-5, GPT-5.1, o1, o3, o4-mini
- **API Type**: `openai-responses` (newer) or `openai-completions` (legacy)
- **Auth**: API Key only
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes (o1, o3, GPT-5 series)
- **Pricing**: Varies by model ($2.5-120/million tokens)
- **Get API Key**: https://platform.openai.com/api-keys

### 3. **Google** (Gemini - Standard API)
- **Models**: gemini-2.0-flash, gemini-2.5-flash, gemini-2.5-pro
- **API Type**: `google-generative-ai`
- **Auth**: API Key only
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes
- **Pricing**: Free tier available, then $0.075-3.50/million tokens
- **Get API Key**: https://aistudio.google.com/app/apikey
- **⚠️ Note**: Use "Custom" provider type in settings

### 4. **Groq**
- **Models**: Llama 3.1/3.2, DeepSeek R1 Distill, Gemma 2
- **API Type**: `openai-completions`
- **Auth**: API Key only
- **Vision**: ❌ No
- **Reasoning**: ✅ Yes (DeepSeek R1 Distill)
- **Pricing**: Very cheap ($0.05-0.99/million tokens)
- **Get API Key**: https://console.groq.com/keys
- **Best for**: Fast, cheap inference

### 5. **Cerebras**
- **Models**: GPT-OSS 120B, Qwen 3, ZAI GLM 4.6/4.7
- **API Type**: `openai-completions`
- **Auth**: API Key only
- **Vision**: ❌ No
- **Reasoning**: ✅ Yes (GPT-OSS)
- **Pricing**: Very cheap
- **Get API Key**: https://cloud.cerebras.ai/

### 6. **xAI** (Grok)
- **Models**: Grok 2, Grok Code Fast, Grok Vision
- **API Type**: `openai-completions`
- **Auth**: API Key only
- **Vision**: ✅ Yes (some models)
- **Reasoning**: ✅ Yes
- **Pricing**: Moderate
- **Get API Key**: https://console.x.ai/

### 7. **Mistral**
- **Models**: Mistral Large, Codestral, Pixtral
- **API Type**: `openai-completions`
- **Auth**: API Key only
- **Vision**: ✅ Yes (Pixtral)
- **Reasoning**: ✅ Yes
- **Pricing**: Moderate
- **Get API Key**: https://console.mistral.ai/api-keys/

### 8. **OpenRouter**
- **Models**: 100+ models including DeepSeek, Qwen, Llama, etc.
- **API Type**: `openai-completions`
- **Auth**: API Key only
- **Vision**: ✅ Yes (model-dependent)
- **Reasoning**: ✅ Yes (model-dependent)
- **Pricing**: Varies by model (aggregates multiple providers)
- **Get API Key**: https://openrouter.ai/settings/keys
- **Best for**: Access to many models with one key

### 9. **Azure OpenAI**
- **Models**: GPT-4o, GPT-5, o1, o3 (via Azure)
- **API Type**: `azure-openai-responses`
- **Auth**: API Key + Endpoint
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes
- **Pricing**: Same as OpenAI + Azure fees
- **Get API Key**: https://portal.azure.com/

### 10. **Google Vertex AI**
- **Models**: Gemini via Google Cloud
- **API Type**: `google-vertex`
- **Auth**: Service Account JSON or ADC
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes
- **Pricing**: Google Cloud pricing
- **Best for**: Enterprise Google Cloud users

---

## ⚠️ OAuth-Only Providers (Special Setup)

These require OAuth authentication and may have limitations:

### 11. **OpenAI Codex** (ChatGPT Plus/Pro)
- **Models**: gpt-5-codex, gpt-5.1-codex, gpt-5-codex-max
- **API Type**: `openai-codex-responses`
- **Auth**: OAuth only (ChatGPT Plus/Pro subscription)
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes
- **Pricing**: Uses your ChatGPT subscription
- **Setup**: Click "Login with ChatGPT Plus/Pro" in settings

### 12. **GitHub Copilot**
- **Models**: Claude Sonnet 4/4.5, GPT-4o, GPT-5, Gemini 2.5 Pro
- **API Type**: `openai-completions` or `openai-responses`
- **Auth**: OAuth only (GitHub Copilot subscription)
- **Vision**: ✅ Yes
- **Reasoning**: ✅ Yes
- **Pricing**: Uses your Copilot subscription
- **⚠️ Note**: Requires special OAuth flow, may not work in browser

---

## ❌ NOT Recommended for Browser Use

These providers are designed for CLI/Node.js environments only:

### 13. **Google Gemini CLI** (Cloud Code Assist)
- **Models**: gemini-2.0-flash, gemini-2.5-pro (via Google Cloud)
- **API Type**: `google-gemini-cli`
- **Auth**: OAuth with local HTTP server
- **❌ Problem**: Requires `http.createServer()` - browser-incompatible
- **✅ Alternative**: Use "Google Generative AI" (custom provider) with API key instead

### 14. **Antigravity**
- **Auth**: OAuth with local server
- **❌ Problem**: Same as Gemini CLI - requires Node.js

---

## 🎯 DeepSeek Provider Setup

**DeepSeek models are available through multiple providers:**

### Option 1: OpenRouter (Recommended)
- **Models Available**:
  - `deepseek/deepseek-chat` (DeepSeek V3)
  - `deepseek/deepseek-r1` (DeepSeek R1 - reasoning)
  - `deepseek/deepseek-chat-v3.1` (DeepSeek V3.1)
  - `deepseek/deepseek-r1-0528` (Latest R1)
  - `deepseek/deepseek-v3.2` (DeepSeek V3.2)
- **Setup**:
  1. Get API key: https://openrouter.ai/settings/keys
  2. In OpenExcel Settings:
     - Provider: `openrouter`
     - Model: Select any DeepSeek model
  3. Done!

### Option 2: Groq
- **Models Available**:
  - `deepseek-r1-distill-llama-70b` (Distilled R1)
- **Setup**:
  1. Get API key: https://console.groq.com/keys
  2. In OpenExcel Settings:
     - Provider: `groq`
     - Model: `deepseek-r1-distill-llama-70b`

### Option 3: Cerebras
- **Models Available**:
  - `deepseek-r1-distill-llama-70b`
- **Setup**:
  1. Get API key: https://cloud.cerebras.ai/
  2. In OpenExcel Settings:
     - Provider: `cerebras`
     - Model: `deepseek-r1-distill-llama-70b`

### Option 4: Direct DeepSeek API (Custom Provider)
- **Setup**:
  1. Get API key: https://platform.deepseek.com/
  2. In OpenExcel Settings:
     - Provider: `Custom`
     - API Type: `OpenAI Completions`
     - Model: `deepseek-chat` or `deepseek-reasoner`
     - Base URL: `https://api.deepseek.com/v1`
     - API Key: Your DeepSeek API key

---

## 🔧 Custom Provider Setup

For any OpenAI-compatible API:

1. In Settings, select **Provider: Custom**
2. Fill in:
   - **API Type**: Choose based on API format
     - `OpenAI Completions` - Most common (Ollama, vLLM, LM Studio, etc.)
     - `OpenAI Responses` - New OpenAI format
     - `Anthropic Messages` - Claude-compatible
     - `Google Generative AI` - Gemini API
   - **Model**: Model ID (e.g., `llama-3.1-8b`, `gpt-4o`)
   - **Base URL**: API endpoint
   - **API Key**: Your API key

---

## 📊 Provider Comparison Table

| Provider | Browser-Safe | OAuth | API Key | Vision | Reasoning | Best For |
|----------|-------------|-------|---------|--------|-----------|----------|
| Anthropic | ✅ | Optional | ✅ | ✅ | ✅ | Best overall quality |
| OpenAI | ✅ | ❌ | ✅ | ✅ | ✅ | Best tool use |
| Google (API) | ✅ | ❌ | ✅ | ✅ | ✅ | Best free tier |
| Groq | ✅ | ❌ | ✅ | ❌ | ✅ | Fastest, cheapest |
| OpenRouter | ✅ | ❌ | ✅ | ✅ | ✅ | Most model variety |
| xAI | ✅ | ❌ | ✅ | ✅ | ✅ | Grok models |
| Mistral | ✅ | ❌ | ✅ | ✅ | ✅ | European models |
| Cerebras | ✅ | ❌ | ✅ | ❌ | ✅ | Fast inference |
| OpenAI Codex | ✅ | ✅ | ❌ | ✅ | ✅ | ChatGPT Plus users |
| GitHub Copilot | ⚠️ | ✅ | ❌ | ✅ | ✅ | Copilot subscribers |
| **DeepSeek (OpenRouter)** | ✅ | ❌ | ✅ | ❌ | ✅ | **Best value reasoning** |
| Gemini CLI | ❌ | ✅ | ❌ | ✅ | ✅ | CLI only (not browser) |

---

## 🚀 Quick Start Recommendations

### For Best Quality:
- **Anthropic Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`)
- **OpenAI GPT-5.1** (`gpt-5.1`)

### For Best Value:
- **DeepSeek V3.1** via OpenRouter (`deepseek/deepseek-chat-v3.1`)
- **DeepSeek R1** via OpenRouter (`deepseek/deepseek-r1`)

### For Free Tier:
- **Google Gemini 2.0 Flash** (`gemini-2.0-flash`) - Free up to limits

### For Speed:
- **Groq** with any model (fastest inference)

### For Reasoning on a Budget:
- **DeepSeek R1** via OpenRouter or Groq

---

## 🔐 API Key Storage

All API keys are stored in **browser localStorage**:
- Key: `zanosheets-config-v2` (provider/model/settings)
- Key: `zanosheets-keys-v2` (API keys per provider)
- ⚠️ **Not encrypted** - visible via DevTools
- ✅ Safe for personal use
- ❌ Not safe for shared computers

For production SaaS, use a backend proxy (see README).
