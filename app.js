const {start} = require('./server/server.js');

start().catch(err => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
