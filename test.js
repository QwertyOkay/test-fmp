const axios = require('axios');

const API_KEY = '4de874cf-403a-4649-8e55-3893a55835ac';
const BASE_URL = 'https://api.finmap.online/v2.2/';
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

axios.get(`${BASE_URL}health`, { headers })
  .then(response => console.log('Тестовий запит:', response.data))
  .catch(error => console.error('Помилка:', error.response ? error.response.data : error.message));