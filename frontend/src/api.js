export const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

export const getAuthHeaders = () => {
  const token = localStorage.getItem('user_token');

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: getAuthHeaders(),
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};
