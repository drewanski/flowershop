jest.mock('../models/User', () => ({ findOne: jest.fn() }));
jest.mock('../utils/FirebaseAdmin', () => ({ getFirebaseAuth: jest.fn() }));

const User = require('../models/User');
const AuthService = require('../services/AuthService');

describe('password reset lifecycle', () => {
  const savedEnv = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    MAIL_FROM: process.env.MAIL_FROM,
    JWT_SECRET: process.env.JWT_SECRET,
  };
  const originalFetch = global.fetch;
  let user;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREVO_API_KEY = 'test-brevo-key';
    process.env.MAIL_FROM = 'noreply@example.test';
    process.env.JWT_SECRET = 'test-jwt-secret-for-tests-only';
    user = {
      _id: 'user-123',
      email: 'customer@example.test',
      firstName: 'Customer',
      tokenVersion: 2,
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('sends a reset email and stores only an expiring OTP hash', async () => {
    let emailedOtp;
    global.fetch = jest.fn().mockImplementation(async (_url, options) => {
      emailedOtp = JSON.parse(options.body).textContent.match(/code is (\d{6})/)[1];
      return { ok: true, status: 201 };
    });
    const result = await AuthService.requestPasswordReset('CUSTOMER@example.test');

    expect(result.status).toBe(200);
    expect(user.passwordResetOtpHash).toMatch(/^[a-f0-9]{64}$/);
    expect(user.passwordResetOtpHash).not.toBe(emailedOtp);
    expect(user.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(global.fetch).toHaveBeenCalledWith('https://api.brevo.com/v3/smtp/email', expect.any(Object));
  });

  test('accepts the emailed code, hashes the new password, and revokes old JWTs', async () => {
    global.fetch = jest.fn().mockImplementation(async (_url, options) => {
      const message = JSON.parse(options.body).textContent;
      const code = message.match(/code is (\d{6})/)[1];
      user.testOtp = code;
      return { ok: true, status: 201 };
    });
    await AuthService.requestPasswordReset(user.email);
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const result = await AuthService.confirmPasswordReset({
      email: user.email,
      otp: user.testOtp,
      newPassword: 'NewSecurePass123',
    });

    expect(result.status).toBe(200);
    expect(user.password).not.toBe('NewSecurePass123');
    expect(user.tokenVersion).toBe(3);
    expect(user.passwordResetOtpHash).toBeUndefined();
  });

  test('increments attempts for an incorrect reset code', async () => {
    user.passwordResetOtpHash = 'a'.repeat(64);
    user.passwordResetExpiresAt = new Date(Date.now() + 60_000);
    user.passwordResetAttempts = 0;
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const result = await AuthService.confirmPasswordReset({
      email: user.email,
      otp: '123456',
      newPassword: 'NewSecurePass123',
    });

    expect(result.status).toBe(400);
    expect(user.passwordResetAttempts).toBe(1);
    expect(user.save).toHaveBeenCalled();
  });
});