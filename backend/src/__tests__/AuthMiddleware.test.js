jest.mock('../utils/AuthUtils', () => ({ verifyJWT: jest.fn() }));

const { verifyJWT } = require('../utils/AuthUtils');
const {
  requireToken,
  requireCustomer,
  requireManagement,
} = require('../middlewares/AuthMiddleware');

const responseMock = () => {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((status) => { res.statusCode = status; return res; });
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
};

describe('authentication and role middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects missing tokens', async () => {
    const req = { headers: {} };
    const res = responseMock();
    const next = jest.fn();

    await requireToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects disabled users even with a valid token', async () => {
    verifyJWT.mockResolvedValue({ _id: 'user-1', role: 'customer', isDisabled: true });
    const req = { headers: { authorization: 'Bearer valid-token' } };
    const res = responseMock();
    const next = jest.fn();

    await requireToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows a customer route only to customers', async () => {
    const req = { user: { _id: 'user-1', role: 'admin' } };
    const res = responseMock();
    const next = jest.fn();

    requireCustomer(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows management routes to admin/manager but not crew', () => {
    const res = responseMock();
    const next = jest.fn();
    requireManagement({ user: { role: 'crew' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();

    const managerNext = jest.fn();
    requireManagement({ user: { role: 'manager' } }, responseMock(), managerNext);
    expect(managerNext).toHaveBeenCalledTimes(1);
  });
});