# OCR Integration Plan - Gemini 2.5 Flash

## Recommended Solution: Google Gemini 2.5 Flash

**Great news!** Google Gemini is already supported in Zano Sheets via the existing `google-generative-ai` provider. No new integrations needed!

### Why Gemini 2.5 Flash?
- ✅ Already integrated (no new dependencies)
- ✅ Native multimodal vision - can process PDFs directly
- ✅ Excellent OCR accuracy (95%+)
- ✅ Fast and cost-effective
- ✅ Free tier available

### How It Works
```
User uploads PDF → Send directly to Gemini 2.5 Flash → Extract structured text/JSON → Match to Excel
```

---

## Implementation Plan

### Phase 1: Add OCR Command
- Create `ocr` command using existing Gemini integration
- Send PDF directly to Gemini (no need to convert to images first)
- Return structured JSON output

### Phase 2: Invoice Matching Skill
- Create skill for invoice matching workflow
- Compare extracted data to Excel transactions
- Output match/no-match results

---

## API Setup

1. Get Google API key from https://aistudio.google.com/app/apikey
2. In Zano Sheets Settings:
   - Provider: **Google Generative AI**
   - Model: **gemini-2.0-flash-exp** (or latest available)
   - API Key: Your Google API key

---

## Usage Example

```
User: "Match these invoices to my transactions"
Agent: [Uses ocr command to extract invoice data]
      [Reads Excel transactions with get-cell-ranges]
      [Compares and outputs match results]
```

---

## Next Steps

1. **Approve** → Switch to Code mode for implementation
2. **Questions?** → Ask for clarification
