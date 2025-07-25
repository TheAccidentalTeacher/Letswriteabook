import axios from 'axios';

// Use relative URLs in production since frontend and backend are served from same domain
// Only use environment variable for local development
const API_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.error('API Error:', error.response || error);
    }
    return Promise.reject(error);
  }
);

export const generateNovel = async (novelData) => {
  const response = await api.post('/api/novel/generate', novelData);
  return response.data;
};

export const getJobStatus = async (jobId) => {
  const response = await api.get(`/api/novel/status/${jobId}`);
  return response.data;
};

export const downloadNovel = async (jobId) => {
  const response = await api.get(`/api/novel/download/${jobId}`);
  return response.data;
};

export const uploadPremise = async (file) => {
  const formData = new FormData();
  formData.append('premise', file);
  
  const response = await api.post('/api/novel/upload-premise', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};

export const getGenres = async () => {
  const response = await api.get('/api/novel/genres');
  return response.data;
};

export const cancelJob = async (jobId) => {
  const response = await api.delete(`/api/novel/${jobId}`);
  return response.data;
};
