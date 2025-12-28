const getExchangeApiUrl = (currency: string) =>
  `${Deno.env.get('EXCHANGE_API_URL')}/${currency}`;

type ExchangeApiResponseBody = {
  conversion_rates: {[key: string]: number};
}

export async function calculateUSDToBRL(usdCents: number) {
  // Use api to get the current exchange
  const response = await fetch(getExchangeApiUrl('USD'));
  const body = (await response.json()) as ExchangeApiResponseBody;

  const brlExchange = body.conversion_rates['BRL']; // 1 usd -> BRL
  const brlAmount = brlExchange * usdCents;
  return Math.floor(brlAmount);
}
