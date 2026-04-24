const fetch = require('node-fetch');

async function test() {
  const url = "https://apikey.4kmedialive.com/api/proxy/v1/chat/completions";
  const apiKey = "sk-119b6e6a2d7033297d5ee264eedf31d5a1afb507e9b574aaac00d3c1e99c3b87";
  const body = {
    model: "llama3.2",
    messages: [{ role: "user", content: "Reply with just OK" }],
    max_tokens: 5
  };

  console.log(`Testing URL: ${url}`);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      timeout: 120000
    });

    console.log(`Status: ${res.status}`);
    const latency = Date.now() - start;
    console.log(`Latency: ${latency}ms`);

    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
