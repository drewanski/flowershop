import { apiRequest, getAuthHeaders } from './api';

describe('frontend API session handling', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('adds the signed-in customer token to API requests', () => {
    localStorage.setItem('user_token', 'session-token');
    expect(getAuthHeaders().Authorization).toBe('Bearer session-token');
  });

  test('returns parsed API data and the HTTP result', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ payload: { orderNumber: 'ORD-1' } }),
    });

    const result = await apiRequest('/orders', { method: 'POST', body: '{}' });

    expect(result).toEqual({ ok: true, status: 201, data: { payload: { orderNumber: 'ORD-1' } } });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/orders$/),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
