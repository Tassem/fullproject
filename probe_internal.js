const http = require('http');
const jwt = require('jsonwebtoken');

const JWT_SECRET = "change-me-in-production-use-a-long-random-string";
const token = jwt.sign({ userId: 4, isAdmin: false }, JWT_SECRET);

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/payments/my-requests',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', data);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
