// Get the API base URL depending on environment
const API_BASE_URL = import.meta.env.PROD 
  ? '/api'  // Production: use relative path
  : 'http://localhost:4000/api';  // Development: use localhost

export default API_BASE_URL;