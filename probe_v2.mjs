async function probe(baseUrl, apiKey) {
  const variations = [
    "/v1",
    "/proxy/v1",
    "/api/v1",
    "/api/proxy/v1"
  ];

  for (const v of variations) {
    const url = baseUrl.replace(/\/$/, "") + v + "/chat/completions";
    console.log(`\n--- Testing: ${url} ---`);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
          stream: false
        }),
        signal: AbortSignal.timeout(5000)
      });
      console.log(`Status: ${res.status}`);
      if (res.status === 200 || res.status === 401 || res.status === 429) {
        return url;
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
  return null;
}

const apiKey = "sk-119b6e6a2d7033297d5ee264eedf31d5a1afb507e9b574aaac00d3c1e99c3b87";
probe("https://apikey.4kmedialive.com/api/nanobanana", apiKey);
