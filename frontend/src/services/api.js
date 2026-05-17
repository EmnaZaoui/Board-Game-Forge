import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const auth = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
};

export const games = {
  list: () => api.get('/games'),
  get: (id) => api.get(`/games/${id}`),
  create: (data) => api.post('/games', data),
  update: (id, data) => api.put(`/games/${id}`, data),
  delete: (id) => api.delete(`/games/${id}`),
};

export const playtest = {
  start: (gameId) => api.post('/playtest/start', { gameId }),
  move: (sessionId, moveJson) => api.post(`/playtest/${sessionId}/move`, { moveJson }),
  complete: (sessionId, score) => api.post(`/playtest/${sessionId}/complete`, { score }),
};

export const recommendations = {
  get: (userId) => api.get(`/recommendations/${userId}`),
};