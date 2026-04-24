async function probe(baseUrl, apiKey) {
  const variations = [
    "",
    "/chat/completions",
    "/v1/chat/completions"
  ];

  for (const v of variations) {
    const url = baseUrl.replace(/\/$/, "") + v;
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
        signal: AbortSignal.timeout(15000)
      });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`Response snippet: ${text.slice(0, 100)}`);
        return url; // Found it
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
  return null;
}

const apiKey = "sk-119b6e6a2d7033297d5ee264eedf31d5a1afb507e9b574aaac00d3c1e99c3b87";
probe("https://apikey.4kmedialive.com/api/nanobanana", apiKey);
