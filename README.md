# query-to-tickers

This is a Next.js application, to launch the development server, simply run

```bash
npm install && npm run dev
```

### Limitations:

For simplicity, under the global market setting, tickers are just returned by the first match (sorted by market, market with overall higher market cap is prioritized). To implement the sort by individual stock's market capitalization, I would incorporate such information from market capitalization api (such as from https://financialmodelingprep.com/api/v3/market-capitalization/ from FMR). To reduce the number of api call, I would cache the market cap data for a reasonable time period.

On our whatsapp conversation, you mentioned the need to handle tickers from provider other than FMP. While I haven't incorporated other data providers, the code structure for this implementation would enable the easy integration of database from other providers. The entity to ticker matching logic is also adaptive to different exchange name that other data providers might use.

UI design is optimized for ease of testing, for better UX, I would hide the geography/market & language selection and make the query submission UI more concise.


### Rough statistics on token usage (per query on average):
Input tokens: 250
Output tokens: 5