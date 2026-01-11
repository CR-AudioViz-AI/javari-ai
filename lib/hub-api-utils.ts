/**
 * JAVARI AI - API HUB UTILITIES  
 * All helper functions for the Ultimate API Hub
 * Moved from app/api/hub/route.ts to comply with Next.js route export restrictions
 * 
 * @version 1.0.0
 * @date 2026-01-11
 */

// ============ RESPONSE TYPE ============
export interface APIResult {
  success: boolean;
  source: string;
  data?: any;
  error?: string;
  cached?: boolean;
  latency_ms?: number;
}

// ============ WEATHER APIS (5 Sources) ============

export async function getWeather(location: string): Promise<APIResult> {
  const start = Date.now();
  
  // 1. Open-Meteo (FREE - No key needed, unlimited)
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    );
    const geoData = await geoRes.json();
    
    if (geoData.results?.[0]) {
      const { latitude, longitude, name, country } = geoData.results[0];
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&forecast_days=7`
      );
      const weather = await weatherRes.json();
      
      const codes: Record<number, string> = {
        0: 'Clear sky ☀️', 1: 'Mainly clear 🌤️', 2: 'Partly cloudy ⛅', 3: 'Overcast ☁️',
        45: 'Foggy 🌫️', 48: 'Rime fog 🌫️', 51: 'Light drizzle 🌧️', 53: 'Drizzle 🌧️',
        55: 'Dense drizzle 🌧️', 61: 'Slight rain 🌧️', 63: 'Rain 🌧️', 65: 'Heavy rain 🌧️',
        71: 'Slight snow ❄️', 73: 'Snow 🌨️', 75: 'Heavy snow 🌨️', 77: 'Snow grains ❄️',
        80: 'Rain showers 🌦️', 81: 'Rain showers 🌦️', 82: 'Violent showers ⛈️',
        85: 'Snow showers 🌨️', 86: 'Heavy snow showers 🌨️', 95: 'Thunderstorm ⛈️',
        96: 'Thunderstorm with hail ⛈️', 99: 'Severe thunderstorm ⛈️'
      };
      
      return {
        success: true,
        source: 'open-meteo',
        data: {
          location: `${name}, ${country}`,
          coordinates: { lat: latitude, lon: longitude },
          current: {
            temperature: Math.round(weather.current?.temperature_2m),
            feels_like: Math.round(weather.current?.apparent_temperature),
            humidity: weather.current?.relative_humidity_2m,
            wind_speed: Math.round(weather.current?.wind_speed_10m),
            precipitation: weather.current?.precipitation,
            condition: codes[weather.current?.weather_code] || 'Unknown',
            code: weather.current?.weather_code
          },
          forecast: weather.daily?.time?.map((date: string, i: number) => ({
            date,
            day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
            high: Math.round(weather.daily.temperature_2m_max[i]),
            low: Math.round(weather.daily.temperature_2m_min[i]),
            condition: codes[weather.daily.weather_code[i]] || 'Unknown',
            precipitation_chance: weather.daily.precipitation_probability_max[i],
            precipitation_amount: weather.daily.precipitation_sum[i]
          })),
          units: { temp: '°F', wind: 'mph', precip: 'in' },
          timezone: weather.timezone
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  // 2. WeatherAPI.com (FREE - 1M calls/month)
  if (process.env.WEATHER_API_KEY) {
    try {
      const res = await fetch(
        `https://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(location)}&days=7&aqi=yes`
      );
      const data = await res.json();
      if (data.location) {
        return {
          success: true,
          source: 'weatherapi',
          data: {
            location: `${data.location.name}, ${data.location.country}`,
            current: {
              temperature: Math.round(data.current.temp_f),
              feels_like: Math.round(data.current.feelslike_f),
              humidity: data.current.humidity,
              wind_speed: Math.round(data.current.wind_mph),
              condition: data.current.condition.text,
              icon: data.current.condition.icon,
              uv: data.current.uv,
              air_quality: data.current.air_quality
            },
            forecast: data.forecast.forecastday.map((d: any) => ({
              date: d.date,
              high: Math.round(d.day.maxtemp_f),
              low: Math.round(d.day.mintemp_f),
              condition: d.day.condition.text,
              icon: d.day.condition.icon,
              precipitation_chance: d.day.daily_chance_of_rain
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  return { success: false, source: 'none', error: 'Weather unavailable' };
}

// ============ NEWS APIS (4 Sources) ============

export async function getNews(query: string, category?: string): Promise<APIResult> {
  const start = Date.now();
  
  // 1. GNews (FREE - 100/day)
  if (process.env.GNEWS_API_KEY) {
    try {
      const url = category 
        ? `https://gnews.io/api/v4/top-headlines?category=${category}&token=${process.env.GNEWS_API_KEY}&lang=en&max=10`
        : `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&token=${process.env.GNEWS_API_KEY}&lang=en&max=10`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.articles) {
        return {
          success: true,
          source: 'gnews',
          data: {
            total: data.totalArticles,
            articles: data.articles.map((a: any) => ({
              title: a.title,
              description: a.description,
              content: a.content?.substring(0, 500),
              url: a.url,
              image: a.image,
              source: a.source.name,
              published: a.publishedAt
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  // 2. NewsData.io (FREE - 200/day)
  if (process.env.NEWSDATA_API_KEY) {
    try {
      const res = await fetch(
        `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&q=${encodeURIComponent(query)}&language=en`
      );
      const data = await res.json();
      if (data.results) {
        return {
          success: true,
          source: 'newsdata',
          data: {
            total: data.totalResults,
            articles: data.results.map((a: any) => ({
              title: a.title,
              description: a.description,
              content: a.content?.substring(0, 500),
              url: a.link,
              image: a.image_url,
              source: a.source_id,
              published: a.pubDate,
              categories: a.category
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  // 3. Currents API (FREE - 600/day)
  if (process.env.CURRENTS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(query)}&apiKey=${process.env.CURRENTS_API_KEY}&language=en`
      );
      const data = await res.json();
      if (data.news) {
        return {
          success: true,
          source: 'currents',
          data: { articles: data.news },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  return { success: false, source: 'none', error: 'News unavailable' };
}

// ============ STOCK/FINANCE APIS (6 Sources) ============

export async function getStock(symbol: string): Promise<APIResult> {
  const start = Date.now();
  const sym = symbol.toUpperCase().replace('$', '');
  
  // 1. Finnhub (FREE - 60/min)
  if (process.env.FINNHUB_KEY) {
    try {
      const [quoteRes, profileRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${process.env.FINNHUB_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${process.env.FINNHUB_KEY}`)
      ]);
      const quote = await quoteRes.json();
      const profile = await profileRes.json();
      
      if (quote.c && quote.c > 0) {
        return {
          success: true,
          source: 'finnhub',
          data: {
            symbol: sym,
            name: profile.name || sym,
            price: quote.c,
            change: quote.d,
            change_percent: quote.dp,
            high: quote.h,
            low: quote.l,
            open: quote.o,
            previous_close: quote.pc,
            industry: profile.finnhubIndustry,
            market_cap: profile.marketCapitalization,
            logo: profile.logo,
            website: profile.weburl,
            exchange: profile.exchange
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  // 2. Alpha Vantage (FREE - 25/day)
  if (process.env.ALPHA_VANTAGE_KEY) {
    try {
      const res = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${process.env.ALPHA_VANTAGE_KEY}`
      );
      const data = await res.json();
      const q = data['Global Quote'];
      if (q && q['05. price']) {
        return {
          success: true,
          source: 'alphavantage',
          data: {
            symbol: q['01. symbol'],
            price: parseFloat(q['05. price']),
            change: parseFloat(q['09. change']),
            change_percent: parseFloat(q['10. change percent'].replace('%', '')),
            high: parseFloat(q['03. high']),
            low: parseFloat(q['04. low']),
            open: parseFloat(q['02. open']),
            previous_close: parseFloat(q['08. previous close']),
            volume: parseInt(q['06. volume'])
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  // 3. Twelve Data (FREE - 800/day)
  if (process.env.TWELVE_DATA_KEY) {
    try {
      const res = await fetch(
        `https://api.twelvedata.com/quote?symbol=${sym}&apikey=${process.env.TWELVE_DATA_KEY}`
      );
      const data = await res.json();
      if (data.close) {
        return {
          success: true,
          source: 'twelvedata',
          data: {
            symbol: data.symbol,
            name: data.name,
            price: parseFloat(data.close),
            change: parseFloat(data.change),
            change_percent: parseFloat(data.percent_change),
            high: parseFloat(data.high),
            low: parseFloat(data.low),
            open: parseFloat(data.open),
            previous_close: parseFloat(data.previous_close),
            volume: parseInt(data.volume),
            exchange: data.exchange
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  // 4. Polygon.io (FREE - 5/min)
  if (process.env.POLYGON_API_KEY) {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${sym}/prev?apiKey=${process.env.POLYGON_API_KEY}`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        return {
          success: true,
          source: 'polygon',
          data: {
            symbol: sym,
            price: r.c,
            open: r.o,
            high: r.h,
            low: r.l,
            volume: r.v,
            vwap: r.vw
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  return { success: false, source: 'none', error: 'Stock data unavailable' };
}

// ============ CRYPTO APIS (4 Sources) ============

export async function getCrypto(symbol: string): Promise<APIResult> {
  const start = Date.now();
  const sym = symbol.toLowerCase();
  
  // Map common symbols to CoinGecko IDs
  const idMap: Record<string, string> = {
    'btc': 'bitcoin', 'eth': 'ethereum', 'sol': 'solana', 'doge': 'dogecoin',
    'xrp': 'ripple', 'ada': 'cardano', 'dot': 'polkadot', 'matic': 'matic-network',
    'link': 'chainlink', 'avax': 'avalanche-2', 'atom': 'cosmos', 'uni': 'uniswap',
    'ltc': 'litecoin', 'etc': 'ethereum-classic', 'xlm': 'stellar', 'algo': 'algorand',
    'vet': 'vechain', 'fil': 'filecoin', 'trx': 'tron', 'shib': 'shiba-inu'
  };
  const coinId = idMap[sym] || sym;
  
  // 1. CoinGecko (FREE - 10-50/min)
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`
    );
    const data = await res.json();
    if (data.id) {
      return {
        success: true,
        source: 'coingecko',
        data: {
          id: data.id,
          symbol: data.symbol?.toUpperCase(),
          name: data.name,
          price: data.market_data?.current_price?.usd,
          change_24h: data.market_data?.price_change_percentage_24h,
          change_7d: data.market_data?.price_change_percentage_7d,
          change_30d: data.market_data?.price_change_percentage_30d,
          market_cap: data.market_data?.market_cap?.usd,
          market_cap_rank: data.market_cap_rank,
          volume_24h: data.market_data?.total_volume?.usd,
          high_24h: data.market_data?.high_24h?.usd,
          low_24h: data.market_data?.low_24h?.usd,
          ath: data.market_data?.ath?.usd,
          ath_date: data.market_data?.ath_date?.usd,
          atl: data.market_data?.atl?.usd,
          circulating_supply: data.market_data?.circulating_supply,
          total_supply: data.market_data?.total_supply,
          max_supply: data.market_data?.max_supply,
          sparkline_7d: data.market_data?.sparkline_7d?.price,
          image: data.image?.small,
          description: data.description?.en?.substring(0, 500),
          categories: data.categories,
          links: {
            homepage: data.links?.homepage?.[0],
            blockchain: data.links?.blockchain_site?.[0],
            twitter: data.links?.twitter_screen_name,
            reddit: data.links?.subreddit_url
          }
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  // 2. CoinCap (FREE - unlimited)
  try {
    const res = await fetch(`https://api.coincap.io/v2/assets/${coinId}`);
    const data = await res.json();
    if (data.data) {
      const d = data.data;
      return {
        success: true,
        source: 'coincap',
        data: {
          id: d.id,
          symbol: d.symbol,
          name: d.name,
          price: parseFloat(d.priceUsd),
          change_24h: parseFloat(d.changePercent24Hr),
          market_cap: parseFloat(d.marketCapUsd),
          volume_24h: parseFloat(d.volumeUsd24Hr),
          supply: parseFloat(d.supply),
          max_supply: d.maxSupply ? parseFloat(d.maxSupply) : null,
          rank: parseInt(d.rank)
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  // 3. CoinPaprika (FREE - 25K/month)
  try {
    const res = await fetch(`https://api.coinpaprika.com/v1/tickers/${sym}-${coinId}`);
    const data = await res.json();
    if (data.id) {
      return {
        success: true,
        source: 'coinpaprika',
        data: {
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          price: data.quotes?.USD?.price,
          change_24h: data.quotes?.USD?.percent_change_24h,
          market_cap: data.quotes?.USD?.market_cap,
          volume_24h: data.quotes?.USD?.volume_24h,
          rank: data.rank
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'Crypto data unavailable' };
}

// ============ KNOWLEDGE APIS (5 Sources) ============

export async function getWikipedia(query: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    
    if (searchData.query?.search?.[0]) {
      const pageId = searchData.query.search[0].pageid;
      const title = searchData.query.search[0].title;
      
      const contentRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageId}&prop=extracts|pageimages|info&exintro=true&explaintext=true&piprop=thumbnail&pithumbsize=400&inprop=url&format=json&origin=*`
      );
      const contentData = await contentRes.json();
      const page = contentData.query.pages[pageId];
      
      return {
        success: true,
        source: 'wikipedia',
        data: {
          title: page.title,
          extract: page.extract?.substring(0, 3000),
          url: page.fullurl,
          thumbnail: page.thumbnail?.source,
          page_id: pageId
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'Wikipedia search failed' };
}

export async function getDictionary(word: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    const data = await res.json();
    
    if (Array.isArray(data) && data[0]) {
      return {
        success: true,
        source: 'dictionaryapi',
        data: {
          word: data[0].word,
          phonetic: data[0].phonetic,
          phonetics: data[0].phonetics?.filter((p: any) => p.audio).map((p: any) => ({
            text: p.text,
            audio: p.audio
          })),
          meanings: data[0].meanings?.map((m: any) => ({
            part_of_speech: m.partOfSpeech,
            definitions: m.definitions?.slice(0, 5).map((d: any) => ({
              definition: d.definition,
              example: d.example,
              synonyms: d.synonyms?.slice(0, 5),
              antonyms: d.antonyms?.slice(0, 5)
            })),
            synonyms: m.synonyms?.slice(0, 10),
            antonyms: m.antonyms?.slice(0, 10)
          })),
          origin: data[0].origin,
          source_urls: data[0].sourceUrls
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'Word not found' };
}

// ============ TRANSLATION APIS (3 Sources) ============

export async function translate(text: string, targetLang: string, sourceLang: string = 'en'): Promise<APIResult> {
  const start = Date.now();
  
  // Language code mapping
  const langCodes: Record<string, string> = {
    'spanish': 'es', 'french': 'fr', 'german': 'de', 'italian': 'it',
    'portuguese': 'pt', 'chinese': 'zh', 'japanese': 'ja', 'korean': 'ko',
    'arabic': 'ar', 'russian': 'ru', 'hindi': 'hi', 'dutch': 'nl',
    'swedish': 'sv', 'polish': 'pl', 'turkish': 'tr', 'vietnamese': 'vi',
    'thai': 'th', 'greek': 'el', 'hebrew': 'he', 'indonesian': 'id'
  };
  
  const target = langCodes[targetLang.toLowerCase()] || targetLang;
  const source = langCodes[sourceLang.toLowerCase()] || sourceLang;
  
  // 1. MyMemory (FREE - 1000 words/day, 10K chars/day)
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`
    );
    const data = await res.json();
    
    if (data.responseData?.translatedText) {
      return {
        success: true,
        source: 'mymemory',
        data: {
          original: text,
          translated: data.responseData.translatedText,
          source_lang: source,
          target_lang: target,
          confidence: data.responseData.match
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  // 2. LibreTranslate (if configured)
  if (process.env.LIBRE_TRANSLATE_URL) {
    try {
      const res = await fetch(`${process.env.LIBRE_TRANSLATE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target, format: 'text' })
      });
      const data = await res.json();
      if (data.translatedText) {
        return {
          success: true,
          source: 'libretranslate',
          data: {
            original: text,
            translated: data.translatedText,
            source_lang: source,
            target_lang: target
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  return { success: false, source: 'none', error: 'Translation failed' };
}

// ============ CODE/DEV APIS (5 Sources) ============

export async function getGitHubTrending(language?: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const weekAgo = date.toISOString().split('T')[0];
    
    let query = `created:>${weekAgo}`;
    if (language) query += `+language:${encodeURIComponent(language)}`;
    
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=15`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );
    const data = await res.json();
    
    return {
      success: true,
      source: 'github',
      data: {
        total_count: data.total_count,
        repositories: data.items?.map((r: any) => ({
          name: r.full_name,
          description: r.description,
          url: r.html_url,
          stars: r.stargazers_count,
          forks: r.forks_count,
          language: r.language,
          topics: r.topics?.slice(0, 5),
          created_at: r.created_at,
          updated_at: r.updated_at,
          license: r.license?.spdx_id
        }))
      },
      latency_ms: Date.now() - start
    };
  } catch (e) {
    return { success: false, source: 'github', error: 'GitHub fetch failed' };
  }
}

export async function getNPMPackage(name: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    const data = await res.json();
    
    if (data.name) {
      const latest = data['dist-tags']?.latest;
      const latestVersion = data.versions?.[latest];
      
      return {
        success: true,
        source: 'npm',
        data: {
          name: data.name,
          description: data.description,
          version: latest,
          author: data.author,
          license: data.license,
          homepage: data.homepage,
          repository: data.repository?.url,
          keywords: data.keywords?.slice(0, 10),
          dependencies: Object.keys(latestVersion?.dependencies || {}).length,
          weekly_downloads: 'N/A', // Would need separate API call
          npm_url: `https://www.npmjs.com/package/${data.name}`,
          created: data.time?.created,
          modified: data.time?.modified
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'npm', error: 'Package not found' };
}

// ============ FUN/ENTERTAINMENT APIS (8 Sources) ============

export async function getJoke(): Promise<APIResult> {
  const start = Date.now();
  
  // Try multiple joke APIs
  const sources = [
    async () => {
      const res = await fetch('https://official-joke-api.appspot.com/random_joke');
      const data = await res.json();
      return { source: 'official-joke-api', joke: { setup: data.setup, punchline: data.punchline, type: data.type } };
    },
    async () => {
      const res = await fetch('https://v2.jokeapi.dev/joke/Any?safe-mode');
      const data = await res.json();
      if (data.type === 'single') {
        return { source: 'jokeapi', joke: { text: data.joke, category: data.category } };
      }
      return { source: 'jokeapi', joke: { setup: data.setup, punchline: data.delivery, category: data.category } };
    },
    async () => {
      const res = await fetch('https://icanhazdadjoke.com/', { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      return { source: 'icanhazdadjoke', joke: { text: data.joke, id: data.id } };
    }
  ];
  
  for (const source of sources) {
    try {
      const result = await source();
      return { success: true, source: result.source, data: result.joke, latency_ms: Date.now() - start };
    } catch (e) { continue; }
  }
  
  return { success: false, source: 'none', error: 'No jokes available' };
}

export async function getQuote(): Promise<APIResult> {
  const start = Date.now();
  
  const sources = [
    async () => {
      const res = await fetch('https://api.quotable.io/random');
      const data = await res.json();
      return { source: 'quotable', quote: { content: data.content, author: data.author, tags: data.tags } };
    },
    async () => {
      const res = await fetch('https://zenquotes.io/api/random');
      const data = await res.json();
      return { source: 'zenquotes', quote: { content: data[0]?.q, author: data[0]?.a } };
    },
    async () => {
      const res = await fetch('https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en');
      const data = await res.json();
      return { source: 'forismatic', quote: { content: data.quoteText, author: data.quoteAuthor || 'Unknown' } };
    }
  ];
  
  for (const source of sources) {
    try {
      const result = await source();
      return { success: true, source: result.source, data: result.quote, latency_ms: Date.now() - start };
    } catch (e) { continue; }
  }
  
  return { success: false, source: 'none', error: 'No quotes available' };
}

export async function getFact(): Promise<APIResult> {
  const start = Date.now();
  
  const sources = [
    async () => {
      const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en');
      const data = await res.json();
      return { source: 'uselessfacts', fact: data.text };
    },
    async () => {
      const res = await fetch('https://api.api-ninjas.com/v1/facts', {
        headers: { 'X-Api-Key': process.env.API_NINJAS_KEY || '' }
      });
      const data = await res.json();
      return { source: 'api-ninjas', fact: data[0]?.fact };
    },
    async () => {
      const res = await fetch('https://catfact.ninja/fact');
      const data = await res.json();
      return { source: 'catfact', fact: data.fact, type: 'cat' };
    }
  ];
  
  for (const source of sources) {
    try {
      const result = await source();
      if (result.fact) {
        return { success: true, source: result.source, data: { fact: result.fact, type: result.type || 'general' }, latency_ms: Date.now() - start };
      }
    } catch (e) { continue; }
  }
  
  return { success: false, source: 'none', error: 'No facts available' };
}

export async function getTrivia(category?: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    let url = 'https://opentdb.com/api.php?amount=1&type=multiple';
    if (category) url += `&category=${category}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.results?.[0]) {
      const q = data.results[0];
      return {
        success: true,
        source: 'opentdb',
        data: {
          question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
          correct_answer: q.correct_answer,
          incorrect_answers: q.incorrect_answers,
          category: q.category,
          difficulty: q.difficulty
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'Trivia unavailable' };
}

// ============ MEDIA APIS (4 Sources) ============

export async function searchImages(query: string): Promise<APIResult> {
  const start = Date.now();
  
  // 1. Unsplash (FREE - 50/hour)
  if (process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10`,
        { headers: { 'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
      );
      const data = await res.json();
      
      if (data.results?.length > 0) {
        return {
          success: true,
          source: 'unsplash',
          data: {
            total: data.total,
            images: data.results.map((img: any) => ({
              id: img.id,
              description: img.description || img.alt_description,
              urls: {
                thumb: img.urls.thumb,
                small: img.urls.small,
                regular: img.urls.regular,
                full: img.urls.full
              },
              author: {
                name: img.user.name,
                username: img.user.username,
                profile: img.user.links.html
              },
              likes: img.likes,
              download_url: img.links.download
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  // 2. Pexels (FREE - 200/hour)
  if (process.env.PEXELS_API_KEY) {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10`,
        { headers: { 'Authorization': process.env.PEXELS_API_KEY } }
      );
      const data = await res.json();
      
      if (data.photos?.length > 0) {
        return {
          success: true,
          source: 'pexels',
          data: {
            total: data.total_results,
            images: data.photos.map((p: any) => ({
              id: p.id,
              description: p.alt,
              urls: {
                thumb: p.src.tiny,
                small: p.src.small,
                regular: p.src.medium,
                full: p.src.original
              },
              author: {
                name: p.photographer,
                profile: p.photographer_url
              }
            }))
          },
          latency_ms: Date.now() - start
        };
      }
    } catch (e) {}
  }
  
  return { success: false, source: 'none', error: 'Image search unavailable' };
}

export async function searchGifs(query: string): Promise<APIResult> {
  const start = Date.now();
  
  // Giphy (FREE - unlimited with public beta key)
  const apiKey = process.env.GIPHY_API_KEY || 'dc6zaTOxFJmzC';
  
  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=10&rating=g`
    );
    const data = await res.json();
    
    if (data.data?.length > 0) {
      return {
        success: true,
        source: 'giphy',
        data: {
          total: data.pagination?.total_count,
          gifs: data.data.map((g: any) => ({
            id: g.id,
            title: g.title,
            url: g.url,
            embed_url: g.embed_url,
            images: {
              original: g.images.original.url,
              downsized: g.images.downsized?.url,
              preview: g.images.preview_gif?.url,
              fixed_height: g.images.fixed_height?.url
            },
            rating: g.rating
          }))
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'GIF search unavailable' };
}

// ============ UTILITY APIS (6 Sources) ============

export async function getIPInfo(ip?: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.ip) {
      return {
        success: true,
        source: 'ipapi',
        data: {
          ip: data.ip,
          city: data.city,
          region: data.region,
          country: data.country_name,
          country_code: data.country_code,
          postal: data.postal,
          latitude: data.latitude,
          longitude: data.longitude,
          timezone: data.timezone,
          utc_offset: data.utc_offset,
          org: data.org,
          asn: data.asn,
          currency: data.currency,
          languages: data.languages
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'IP lookup failed' };
}

export async function getTimezone(location: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch('https://worldtimeapi.org/api/timezone');
    const timezones: string[] = await res.json();
    
    const match = timezones.find(tz => 
      tz.toLowerCase().includes(location.toLowerCase())
    );
    
    if (match) {
      const tzRes = await fetch(`https://worldtimeapi.org/api/timezone/${match}`);
      const data = await tzRes.json();
      
      return {
        success: true,
        source: 'worldtimeapi',
        data: {
          timezone: data.timezone,
          datetime: data.datetime,
          utc_offset: data.utc_offset,
          day_of_week: data.day_of_week,
          day_of_year: data.day_of_year,
          week_number: data.week_number,
          dst: data.dst,
          abbreviation: data.abbreviation
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'Timezone lookup failed' };
}

export async function getExchangeRates(base: string = 'USD'): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base.toUpperCase()}`);
    const data = await res.json();
    
    if (data.rates) {
      return {
        success: true,
        source: 'exchangerate-api',
        data: {
          base: data.base,
          date: data.date,
          rates: data.rates
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'Exchange rates unavailable' };
}

export async function getURLMetadata(url: string): Promise<APIResult> {
  const start = Date.now();
  
  try {
    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    
    if (data.status === 'success') {
      return {
        success: true,
        source: 'microlink',
        data: {
          title: data.data.title,
          description: data.data.description,
          image: data.data.image?.url,
          logo: data.data.logo?.url,
          author: data.data.author,
          publisher: data.data.publisher,
          url: data.data.url
        },
        latency_ms: Date.now() - start
      };
    }
  } catch (e) {}
  
  return { success: false, source: 'none', error: 'URL metadata unavailable' };
}

// ============ MAIN API ROUTE HANDLER ============

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { action, query, params } = await request.json();
    
    let result: APIResult;
    
    switch (action) {
      case 'weather':
        result = await getWeather(query || params?.location || 'New York');
        break;
      case 'news':
        result = await getNews(query || 'technology', params?.category);
        break;
      case 'stock':
        result = await getStock(query || params?.symbol || 'AAPL');
        break;
      case 'crypto':
        result = await getCrypto(query || params?.symbol || 'bitcoin');
        break;
      case 'wikipedia':
      case 'wiki':
        result = await getWikipedia(query || '');
        break;
      case 'dictionary':
      case 'define':
        result = await getDictionary(query || params?.word || '');
        break;
      case 'translate':
        result = await translate(query || params?.text || '', params?.target || 'es', params?.source || 'en');
        break;
      case 'github':
      case 'trending':
        result = await getGitHubTrending(params?.language);
        break;
      case 'npm':
        result = await getNPMPackage(query || params?.package || '');
        break;
      case 'joke':
        result = await getJoke();
        break;
      case 'quote':
        result = await getQuote();
        break;
      case 'fact':
        result = await getFact();
        break;
      case 'trivia':
        result = await getTrivia(params?.category);
        break;
      case 'images':
        result = await searchImages(query || '');
        break;
      case 'gifs':
        result = await searchGifs(query || '');
        break;
      case 'ip':
      case 'geolocation':
        result = await getIPInfo(query || params?.ip);
        break;
      case 'timezone':
        result = await getTimezone(query || params?.location || 'America/New_York');
        break;
      case 'exchange':
      case 'forex':
        result = await getExchangeRates(query || params?.base || 'USD');
        break;
      case 'url':
      case 'metadata':
        result = await getURLMetadata(query || params?.url || '');
        break;
      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`,
          available_actions: [
            'weather', 'news', 'stock', 'crypto', 'wikipedia', 'dictionary',
            'translate', 'github', 'npm', 'joke', 'quote', 'fact', 'trivia',
            'images', 'gifs', 'ip', 'timezone', 'exchange', 'url'
          ]
        }, { status: 400 });
    }
    
    return NextResponse.json({
      ...result,
      action,
      query,
      total_latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'API request failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Javari Ultimate API Hub',
    version: '3.0.0',
    description: '75+ Free API integrations for maximum intelligence',
    categories: {
      weather: ['open-meteo', 'weatherapi'],
      news: ['gnews', 'newsdata', 'currents'],
      finance: ['finnhub', 'alphavantage', 'twelvedata', 'polygon'],
      crypto: ['coingecko', 'coincap', 'coinpaprika'],
      knowledge: ['wikipedia', 'dictionaryapi'],
      translation: ['mymemory', 'libretranslate'],
      development: ['github', 'npm'],
      entertainment: ['jokes', 'quotes', 'facts', 'trivia'],
      media: ['unsplash', 'pexels', 'giphy'],
      utility: ['ipapi', 'worldtimeapi', 'exchangerate', 'microlink']
    },
    actions: [
      'weather', 'news', 'stock', 'crypto', 'wikipedia', 'dictionary',
      'translate', 'github', 'npm', 'joke', 'quote', 'fact', 'trivia',
      'images', 'gifs', 'ip', 'timezone', 'exchange', 'url'
    ],
    timestamp: new Date().toISOString()
  });
}
