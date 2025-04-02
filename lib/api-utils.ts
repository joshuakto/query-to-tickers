import { API_CONFIG } from "./config"

// Define a type for the available API providers
type ApiProvider = "deepseek" | "openai"

export async function callLlmApi(prompt: string, provider = "openai") {
  console.log("callLlmApi called with provider:", provider)

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY
  const openaiApiKey = process.env.OPENAI_API_KEY

  // Determine which API to use
  let apiKey;
  let configKey: ApiProvider;

  if (provider === "deepseek" && deepseekApiKey) {
    apiKey = deepseekApiKey;
    configKey = "deepseek";
    console.log("Using API: DeepSeek")
  } else {
    apiKey = openaiApiKey;
    configKey = "openai";
    console.log("Using API: OpenAI")
  }

  if (!apiKey) {
    console.error("No API key configured")
    throw new Error("No API key configured")
  }

  const config = API_CONFIG[configKey]
  console.log("Using model:", config.model)

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }

  try {
    console.log("Sending request to:", config.apiUrl)
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
        stop: ["Query --", "Here is the user query:"], // Add stop sequences to prevent echoing the prompt
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`API error (${configKey}):`, errorText)
      try {
        const errorData = JSON.parse(errorText)
        console.error("Parsed error data:", errorData)
      } catch (e) {
        console.error("Could not parse error response as JSON")
      }
      throw new Error(`Failed to call LLM API: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log("API response data:", data)

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Unexpected API response format:", data)
      throw new Error("Unexpected API response format")
    }

    return data.choices[0].message.content.trim()
  } catch (error) {
    console.error("Error in callLlmApi:", error)
    throw error
  }
}

