const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config', 'config.env'), quiet: true });

const connectDB = require('./config/db');
const app = require('./app');
const { startReminderJob } = require('./jobs/reminder');

const PORT = process.env.PORT || 5001;

const start = async () => {
  await connectDB();
  const server = app.listen(PORT, () =>
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
  );

  startReminderJob();

  process.on('unhandledRejection', (err) => {
    console.error(`Unhandled rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });
};

start().catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});
