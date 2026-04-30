import fetch from 'node-fetch';

async function test() {
  const baseUrl = 'http://localhost:8087'; // api is on 8087 in docker-compose
  const auth = { 'x-user-id': '4' }; // We saw user 4 has a request in DB

  console.log("Probing /api/payments/my-requests...");
  try {
    const r = await fetch(`${baseUrl}/api/payments/my-requests`, {
      headers: { ...auth }
    });
    console.log("Status:", r.status);
    const data = await r.json();
    console.log("Data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
