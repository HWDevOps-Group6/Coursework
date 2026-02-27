const User = require('../models/User');
const DoctorSchedule = require('../models/DoctorSchedule');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');

const buildDefaultHalfHourSlots = () => {
  const slots = [];
  for (let hour = 9; hour < 17; hour += 1) {
    const fromHour = String(hour).padStart(2, '0');
    const toHour = String(hour + 1).padStart(2, '0');
    slots.push({ startTime: `${fromHour}:00`, endTime: `${fromHour}:30` });
    slots.push({ startTime: `${fromHour}:30`, endTime: `${toHour}:00` });
  }
  return slots;
};

const buildDefaultWeeklyAvailability = () => {
  const dailySlots = buildDefaultHalfHourSlots();
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    slots: dailySlots
  }));
};

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

  if (user.role === 'doctor') {
    const doctorName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const departmentValue = Array.isArray(user.department) && user.department.length > 0
      ? user.department[0]
      : undefined;

    await DoctorSchedule.findOneAndUpdate(
      { doctorId: user._id.toString() },
      {
        $setOnInsert: {
          doctorId: user._id.toString(),
          doctorName,
          department: departmentValue,
          weeklyAvailability: buildDefaultWeeklyAvailability(),
          createdBy: user._id.toString(),
          updatedBy: user._id.toString(),
          source: 'api'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

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

const listDoctors = async () => {
  const doctors = await User.find({ role: 'doctor', isActive: true })
    .select('_id firstName lastName email department')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  return doctors.map((doctor) => ({
    id: doctor._id.toString(),
    firstName: doctor.firstName,
    lastName: doctor.lastName,
    fullName: `${doctor.firstName} ${doctor.lastName}`.trim(),
    email: doctor.email,
    department: doctor.department || []
  }));
};

module.exports = { register, login, findOrCreateFromGoogle, getUserById, listDoctors };
