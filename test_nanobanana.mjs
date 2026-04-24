


const baseUrl = 'http://192.168.1.2/api/nanobanana';
const url = baseUrl + '/generate';
const prompt = 'A beautiful sunset over a tropical beach';

console.log('Testing Nanobanana Generation...');
console.log('Target URL:', url);

async function test() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key' // We can use dummy key if auth is bypassed for test
      },
      body: JSON.stringify({ prompt, aspect_ratio: '16:9' })
    });

    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
