// API configuration
export const API_CONFIG = {
  // DeepSeek API
  deepseek: {
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
  },

  // OpenAI API
  openai: {
    apiUrl: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
  },

  // FMP API
  fmp: {
    apiUrl: "https://financialmodelingprep.com/api/v3/stock/list",
    cacheDuration: 3600000, // 1 hour in milliseconds
  },
}

