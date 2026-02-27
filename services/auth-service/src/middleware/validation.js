const Joi = require('joi');
const { sendError } = require('../../../../shared/http/responses');

const ALLOWED_DEPARTMENTS = [
  'Medicine',
  'Surgery',
  'Orthopedics',
  'Pediatrics',
  'ENT',
  'Ophthalmology',
  'Gynecology',
  'Dermatology',
  'Oncology'
];

const CARE_ROLES = ['doctor', 'nurse', 'clinician'];

const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    if (error) {
      const errors = error.details.map(d => ({ field: d.path.join('.'), message: d.message }));
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input data', errors);
    }
    req[property] = value;
    next();
  };
};

const schemas = {
  register: Joi.object({
    email: Joi.string().email().required().messages({ 'string.email': 'Please provide a valid email address', 'any.required': 'Email is required' }),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase, lowercase, number, and special character',
        'any.required': 'Password is required'
      }),
    firstName: Joi.string().trim().required().messages({ 'any.required': 'First name is required' }),
    lastName: Joi.string().trim().required().messages({ 'any.required': 'Last name is required' }),
    role: Joi.string().valid('clerk', 'doctor', 'nurse', 'paramedic', 'clinician', 'admin').default('clerk'),
    phoneNumber: Joi.string().trim().allow('', null).optional(),
    department: Joi.alternatives()
      .try(
        Joi.string().trim(),
        Joi.array().items(Joi.string().trim()).min(1)
      )
      .allow(null, '')
      .optional()
  }).custom((value, helpers) => {
    const rawDepartment = value.department;
    let departments = [];

    if (Array.isArray(rawDepartment)) {
      departments = rawDepartment.map((item) => item.trim()).filter(Boolean);
    } else if (typeof rawDepartment === 'string') {
      const trimmed = rawDepartment.trim();
      departments = trimmed ? [trimmed] : [];
    }

    const hasInvalidDepartment = departments.some((dept) => !ALLOWED_DEPARTMENTS.includes(dept));
    if (hasInvalidDepartment) {
      return helpers.error('any.custom', {
        message: `department must be one or more of: ${ALLOWED_DEPARTMENTS.join(', ')}`
      });
    }

    if (CARE_ROLES.includes(value.role)) {
      if (departments.length === 0) {
        return helpers.error('any.custom', {
          message: `${value.role} must belong to at least one department`
        });
      }

      if (value.role === 'doctor' && departments.length !== 1) {
        return helpers.error('any.custom', {
          message: 'doctor must belong to exactly one department'
        });
      }
    }

    value.department = departments.length ? departments : undefined;
    return value;
  }, 'role-based department validation').messages({
    'any.custom': '{{#message}}'
  }),
  login: Joi.object({
    email: Joi.string().email().required().messages({ 'string.email': 'Please provide a valid email address', 'any.required': 'Email is required' }),
    password: Joi.string().required().messages({ 'any.required': 'Password is required' })
  })
};

module.exports = { validate, schemas };
