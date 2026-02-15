const mongoose = require('mongoose');

const connectDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for main API');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[API] MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = { connectDatabase };
