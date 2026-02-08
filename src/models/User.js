const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  passwordHash: {
    type: String,
    required: false,
    minlength: [8, 'Password must be at least 8 characters']
    // Optional for Google OAuth users - they authenticate via Google, not password
  },
  googleId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
    // Google's unique user ID - used for OAuth sign-in
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
    // 'local' = email/password, 'google' = Google OAuth
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: ['clerk', 'doctor', 'nurse', 'paramedic'],
    default: 'clerk'
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Validate: local users need passwordHash, Google users need googleId
userSchema.pre('save', function(next) {
  if (this.authProvider === 'google' && !this.googleId) {
    next(new Error('Google users must have googleId'));
  } else if (this.authProvider === 'local' && !this.passwordHash) {
    next(new Error('Local users must have passwordHash'));
  } else {
    next();
  }
});

// Index for email (unique index is created automatically)
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ department: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Method to compare password (only for local/auth users with passwordHash)
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.passwordHash) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Method to exclude password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);

