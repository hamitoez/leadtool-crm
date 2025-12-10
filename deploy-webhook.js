const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PORT = 9000;
const SECRET = crypto.randomBytes(32).toString('hex');
const PROJECT_DIR = '/var/www/leadtool';

// Save secret to file for reference
require('fs').writeFileSync('/var/www/leadtool/.webhook-secret', SECRET);

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/deploy') {
    let body = '';

    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {
      // Verify GitHub signature
      const signature = req.headers['x-hub-signature-256'];
      if (signature) {
        const hmac = crypto.createHmac('sha256', SECRET);
        const digest = 'sha256=' + hmac.update(body).digest('hex');
        if (signature !== digest) {
          res.writeHead(401);
          res.end('Invalid signature');
          return;
        }
      }

      console.log(`[${new Date().toISOString()}] Deploy triggered`);

      try {
        // Pull latest changes
        console.log('Pulling latest changes...');
        execSync('git pull origin main', { cwd: PROJECT_DIR, stdio: 'inherit' });

        // Install dependencies if package.json changed
        console.log('Installing dependencies...');
        execSync('npm install --production=false', { cwd: PROJECT_DIR, stdio: 'inherit' });

        // Build the project
        console.log('Building project...');
        execSync('npm run build', { cwd: PROJECT_DIR, stdio: 'inherit' });

        // Restart PM2 processes
        console.log('Restarting services...');
        execSync('pm2 restart leadtool', { stdio: 'inherit' });

        console.log('Deploy completed successfully!');
        res.writeHead(200);
        res.end('Deploy successful');
      } catch (error) {
        console.error('Deploy failed:', error.message);
        res.writeHead(500);
        res.end('Deploy failed: ' + error.message);
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Deploy webhook listening on port ${PORT}`);
  console.log(`Webhook URL: http://YOUR_SERVER_IP:${PORT}/deploy`);
  console.log(`Secret saved to ${PROJECT_DIR}/.webhook-secret`);
});
