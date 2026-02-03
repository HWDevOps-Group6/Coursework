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
    department
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
  getUserById
};

