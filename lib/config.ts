// API configuration
export const API_CONFIG = {
  // DeepSeek API
  deepseek: {
    apiUrl: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
  },

  // OpenRouter API
  openrouter: {
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "deepseek/deepseek-chat-v3-0324:free", // Updated model ID
    referer: "https://stock-ticker-identifier.vercel.app", // Replace with your actual domain
    title: "Stock Ticker Identifier",
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

