async function test() {
  const url = "https://apikey.4kmedialive.com/nanobanana";
  const apiKey = "sk-119b6e6a2d7033297d5ee264eedf31d5a1afb507e9b574aaac00d3c1e99c3b87";
  const body = {
    model: "llama3.2",
    messages: [{ role: "user", content: "Reply with just OK" }],
    max_tokens: 5,
    stream: false
  };

  console.log(`Testing URL: ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log("Raw Response:", text);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
