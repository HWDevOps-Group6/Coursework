const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Object} Created user and JWT token
 * @throws {Error} If user already exists or validation fails
 */
const register = async (userData) => {
  const { email, password, firstName, lastName, role, phoneNumber, department } = userData;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const user = new User({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role: role || 'clerk',
    phoneNumber,
    department,
    authProvider: 'local'
  });

  await user.save();

  // Generate JWT token
  const token = generateToken(user);

  // Return user (without password) and token
  const userObject = user.toJSON();
  return {
    user: userObject,
    token
  };
};

/**
 * Authenticate user and generate token
 * @param {String} email - User email
 * @param {String} password - User password
 * @returns {Object} User and JWT token
 * @throws {Error} If credentials are invalid
 */
const login = async (email, password) => {
  // Find user by email
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new Error('User account is deactivated');
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate JWT token
  const token = generateToken(user);

  // Return user (without password) and token
  const userObject = user.toJSON();
  return {
    user: userObject,
    token
  };
};

/**
 * Find or create user from Google OAuth profile
 * @param {Object} profile - Google profile from passport (id, displayName, name, emails)
 * @returns {Object} User and JWT token
 * @throws {Error} If domain restriction fails (when ALLOWED_EMAIL_DOMAINS is set)
 */
const findOrCreateFromGoogle = async (profile) => {
  const email = profile.emails?.[0]?.value?.toLowerCase();
  if (!email) {
    throw new Error('Email not provided by Google');
  }

  // TODO: In production, restrict sign-in to organization emails for security.
  // Uncomment and configure ALLOWED_EMAIL_DOMAINS in .env (e.g. "hospital.com,clinic.org")
  // to only allow users from trusted domains.
  // const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS?.split(',').map(d => d.trim());
  // if (allowedDomains?.length && !allowedDomains.some(d => email.endsWith(`@${d}`))) {
  //   throw new Error(`Sign-in restricted to allowed domains: ${allowedDomains.join(', ')}`);
  // }

  const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
  const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';

  let user = await User.findOne({ googleId: profile.id });
  if (user) {
    user.lastLogin = new Date();
    await user.save();
  } else {
    user = await User.findOne({ email });
    if (user) {
      user.googleId = profile.id;
      user.authProvider = 'google';
      user.lastLogin = new Date();
      await user.save();
    } else {
      user = new User({
        email,
        googleId: profile.id,
        authProvider: 'google',
        firstName,
        lastName,
        role: 'clerk',
        lastLogin: new Date()
      });
      await user.save();
    }
  }

  if (!user.isActive) {
    throw new Error('User account is deactivated');
  }

  const token = generateToken(user);
  const userObject = user.toJSON();
  return { user: userObject, token };
};

/**
 * Get user by ID
 * @param {String} userId - User ID
 * @returns {Object} User object
 * @throws {Error} If user not found
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (!user.isActive) {
    throw new Error('User account is deactivated');
  }
  return user.toJSON();
};

module.exports = {
  register,
  login,
  findOrCreateFromGoogle,
  getUserById
};

