const passwordRules = [
  {
    name: 'length',
    validate: (value) => value.length > 8,
    message: 'Password must be longer than 8 characters (minimum 9).'
  },
  {
    name: 'uppercase',
    validate: (value) => /[A-Z]/.test(value),
    message: 'Password must include at least one uppercase letter.'
  },
  {
    name: 'lowercase',
    validate: (value) => /[a-z]/.test(value),
    message: 'Password must include at least one lowercase letter.'
  },
  {
    name: 'special',
    validate: (value) => /[^A-Za-z0-9]/.test(value),
    message: 'Password must include at least one special character.'
  }
];

function validatePassword(password) {
  const errors = passwordRules
    .filter((rule) => !rule.validate(password))
    .map((rule) => rule.message);

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  passwordRules,
  validatePassword
};
