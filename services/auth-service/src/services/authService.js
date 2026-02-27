const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

const normalizeDepartmentInput = (department) => {
  if (Array.isArray(department)) {
    const cleaned = department
      .map((dept) => (typeof dept === 'string' ? dept.trim() : dept))
      .filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  }

  if (typeof department === 'string') {
    const trimmed = department.trim();
    return trimmed ? [trimmed] : undefined;
  }

  return undefined;
};

const register = async (userData) => {
  const { email, password, firstName, lastName, role, phoneNumber, department } = userData;
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) throw new Error('User with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = new User({
    email: email.toLowerCase(),
    passwordHash,
    firstName,
    lastName,
    role: role || 'clerk',
    phoneNumber,
    department: normalizeDepartmentInput(department),
    authProvider: 'local'
  });
  await user.save();

  const token = generateToken(user);
  return { user: user.toJSON(), token };
};

const login = async (email, password) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new Error('Invalid email or password');
  if (!user.isActive) throw new Error('User account is deactivated');
  const isValid = await user.comparePassword(password);
  if (!isValid) throw new Error('Invalid email or password');

  user.lastLogin = new Date();
  await user.save();

  const token = generateToken(user);
  return { user: user.toJSON(), token };
};

const findOrCreateFromGoogle = async (profile) => {
  const email = profile.emails?.[0]?.value?.toLowerCase();
  if (!email) throw new Error('Email not provided by Google');

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

  if (!user.isActive) throw new Error('User account is deactivated');
  const token = generateToken(user);
  return { user: user.toJSON(), token };
};

const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!user.isActive) throw new Error('User account is deactivated');
  return user.toJSON();
};

module.exports = { register, login, findOrCreateFromGoogle, getUserById };
