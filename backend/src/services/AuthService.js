const User = require('../models/User');
const EmployeeLog = require('../models/EmployeeLog');
const crypto = require('crypto');
const { getFirebaseAuth } = require('../utils/FirebaseAdmin');

const AuthResponses = require('../responses/AuthResponses');
const GenericResponses = require('../responses/GenericResponses');

const { encryptPassword, passwordsMatch, generateJWT } = require('../utils/AuthUtils');
const LogUtils = require('../utils/LogUtils');
const { isValidEmail, isValidPhoneNumber } = require('../utils/UserUtils');

//=======================//
// CUSTOMER REGISTRATION //
//=======================//

const registerCustomer = async (userData) => {
  const { firstName, middleName, lastName, contactNumber, homeAddress, username, email, password } = userData || {};

  // Validate required fields

  const missingFields = [];

  if (!firstName?.trim()) missingFields.push('firstName');
  if (!lastName?.trim()) missingFields.push('lastName');
  if (!contactNumber?.trim()) missingFields.push('contactNumber');

  if (!username?.trim()) missingFields.push('username');
  if (!email?.trim()) missingFields.push('email');
  if (!password) missingFields.push('password');

  if (missingFields.length > 0)
    return AuthResponses.registration.missingData(missingFields);

  // Validate email and contact number formats

  const invalidFields = [];

  if (!isValidPhoneNumber(contactNumber.trim())) invalidFields.push('contactNumber');
  if (!isValidEmail(email.trim())) invalidFields.push('email');

  if (invalidFields.length > 0)
    return AuthResponses.registration.invalidData(invalidFields);

  try {
    const existingUser = await User.findOne({
      $or: [
        { email: email.trim().toLowerCase() },
        { username: username.trim() },
        { contactNumber: contactNumber.trim() }
      ]
    });

    if (existingUser) return AuthResponses.registration.userAlreadyExists();

    if (typeof password !== 'string' || password.length < 8)
      return AuthResponses.registration.invalidData(['password']);

    const hashedPassword = await encryptPassword(password);

    const newUser = await User.create({
      firstName: firstName.trim(),
      middleName: middleName?.trim() || undefined,
      lastName: lastName.trim(),
      contactNumber: contactNumber.trim(),
      homeAddress: homeAddress?.trim() || undefined,
      
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
    });

    newUser.password = undefined; // Remove password from the response

    return AuthResponses.registration.success(newUser);
  } catch (error) {
    LogUtils.logError(`Error in registerCustomer: ${error.message}`);
    return GenericResponses.internalServerError();
  }
}

//============//
// USER LOGIN //
//============//

const login = async (email, password) => {
  let username;
  let contactNumber;

  // Validate required fields

  const missingFields = [];

  if (!email?.trim()) missingFields.push('email');
  if (!password) missingFields.push('password');

  if (missingFields.length > 0)
    return AuthResponses.login.missingData(missingFields);

  // Assume contact number if email is not valid and is a valid phone number,
  // otherwise assume username
  
  if (!isValidEmail(email.trim()) && isValidPhoneNumber(email.trim()))
    contactNumber = email.trim();
  else
    username = email.trim();

  try {
    const user = await User.findOne({
      $or: [
        { email: email.trim().toLowerCase() },
        { username },
        { contactNumber }
      ]
    });

    // User enumeration attack trap

    if (!user) {
      // Dummy hash for timing attack mitigation
      await passwordsMatch(password, '$2a$10$2kOvhI7tsdn5dimSrOISxe8BDG7YlzRz6xiu8CPC.CJBL1nzzkaKq')
      return AuthResponses.login.invalidData(['email', 'password']);
    }

    const isPasswordMatch = await passwordsMatch(password, user.password);

    if (!isPasswordMatch) return AuthResponses.login.invalidData(['email', 'password']);
    if (user.isDisabled) return AuthResponses.login.invalidData(['email', 'password']);

    const token = generateJWT(user);
    let lastLogin;

    if (user.role !== 'customer') {
      try {
        const previousLogin = await EmployeeLog.findOne({ user: user._id }).sort({ createdAt: -1 });
        lastLogin = previousLogin?.createdAt;
        await EmployeeLog.create({
          user: user._id,
          email: user.email,
          role: user.role,
        });
      } catch (error) {
        LogUtils.logError(`Unable to record employee login: ${error.message}`);
      }
    }

    user.password = undefined; // Remove password from the response

    return AuthResponses.login.success({ user, token, ...(lastLogin ? { lastLogin } : {}) });
  } catch (error) {
    LogUtils.logError(`Error in login: ${error.message}`);
    return GenericResponses.internalServerError();
  }
}

const googleLogin = async ({ idToken, contactNumber, homeAddress } = {}) => {
  if (typeof idToken !== 'string' || !idToken) {
    return { status: 400, message: 'A Firebase ID token is required.' };
  }

  let claims;
  try {
    claims = await getFirebaseAuth().verifyIdToken(idToken);
  } catch (error) {
    return { status: 401, message: 'Google sign-in could not be verified.' };
  }

  const email = claims.email?.trim().toLowerCase();
  if (!email || !claims.email_verified) {
    return { status: 401, message: 'A verified Google email is required.' };
  }

  try {
    let user = await User.findOne({ email });

    if (!user) {
      if (!contactNumber) {
        return {
          status: 428,
          payload: { requiresContactNumber: true },
          message: 'Enter a contact number to finish creating your account.',
        };
      }
      if (!isValidPhoneNumber(String(contactNumber).trim())) {
        return { status: 400, message: 'Enter a valid contact number.' };
      }

      const nameParts = (claims.name || 'Google Customer').trim().split(/\s+/);
      const usernamePrefix = (email.split('@')[0].replace(/[^a-z0-9_]/gi, '').slice(0, 19) || 'google');
      let username = `${usernamePrefix}_${claims.uid.slice(-8)}`;
      let suffix = 1;
      while (await User.exists({ username })) {
        username = `${usernamePrefix.slice(0, 17)}_${claims.uid.slice(-6)}${suffix++}`;
      }

      user = await User.create({
        firstName: nameParts[0] || 'Google',
        lastName: nameParts.slice(1).join(' ') || 'Customer',
        contactNumber: String(contactNumber).trim(),
        homeAddress: typeof homeAddress === 'string' ? homeAddress.trim() : undefined,
        username,
        email,
        password: await encryptPassword(crypto.randomBytes(32).toString('base64url')),
        role: 'customer',
      });
    }

    if (user.isDisabled) {
      return { status: 403, message: 'This account is disabled.' };
    }

    const token = generateJWT(user);
    if (user.role !== 'customer') {
      await EmployeeLog.create({ user: user._id, email: user.email, role: user.role });
    }
    user.password = undefined;
    return { status: 200, payload: { user, token }, message: 'Google sign-in successful.' };
  } catch (error) {
    if (error.code === 11000) {
      const existingUser = await User.findOne({ email });
      if (existingUser && !existingUser.isDisabled) {
        return { status: 200, payload: { user: existingUser, token: generateJWT(existingUser) }, message: 'Google sign-in successful.' };
      }
    }
    LogUtils.logError(`Error in googleLogin: ${error.message}`);
    return { status: 500, message: 'Unable to complete Google sign-in.' };
  }
};

const updateProfile = async (userId, profileData = {}) => {
  const firstName = typeof profileData.firstName === 'string' ? profileData.firstName.trim() : '';
  const lastName = typeof profileData.lastName === 'string' ? profileData.lastName.trim() : '';
  if (!firstName || !lastName) {
    return { status: 400, message: 'First name and last name are required.' };
  }

  const user = await User.findByIdAndUpdate(
    userId,
    {
      firstName,
      lastName,
      ...(typeof profileData.homeAddress === 'string'
        ? { homeAddress: profileData.homeAddress.trim() }
        : {}),
    },
    { new: true, runValidators: true }
  ).select('-password');

  return user
    ? { status: 200, payload: user, message: 'Profile updated.' }
    : { status: 404, message: 'User not found.' };
};

//========//
// EXPORT //
//========//

module.exports = {
  registerCustomer,
  login,
  googleLogin,
  updateProfile,
};
