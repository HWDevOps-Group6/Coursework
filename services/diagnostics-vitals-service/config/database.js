const mongoose = require('mongoose');

const connectDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for patient registration service');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[Diagnostics And Vitals] MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = { connectDatabase };
