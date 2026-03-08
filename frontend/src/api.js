import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000',
});

// For calls like /signIn which are at the root
export const rootApi = axios.create({
    baseURL: 'http://localhost:5000',
});

export default api;
