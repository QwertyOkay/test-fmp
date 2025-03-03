const axios = require('axios');
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Імпортуємо транзакції з файлу
const rawTransactions = JSON.parse(fs.readFileSync('transactions.json', 'utf8'));
const transactions = rawTransactions.map(tx => ({
  ...tx,
  id: uuidv4() // Генеруємо унікальний externalId для кожної транзакції
}));

const app = express();

// Конфігурація
const API_KEY = '4de874cf-403a-4649-8e55-3893a55835ac4d2960174080a3170efe5d88bc88537f6dbcf055';
const BASE_URL = 'https://api.finmap.online/v2.2/';
const headers = {
  'apiKey': API_KEY,
  'Content-Type': 'application/json',
};

// Зберігання даних від вебхуків
let webhookResults = [];
let server;

// Функція для перевірки/створення сутності
async function ensureEntityExists(endpoint, name, createPayload) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}?name=${name}`, { headers });
    const items = response.data;
    if (items && items.length > 0) {
      console.log(`${endpoint} для ${name} знайдено, ID: ${items[0].id}`);
      return items[0].id;
    }
    console.log(`${endpoint} для ${name} не знайдено, створюємо...`);
    const createResponse = await axios.post(`${BASE_URL}${endpoint}`, createPayload, { headers });
    return createResponse.data.id;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`${endpoint} для ${name} не знайдено, створюємо...`);
      const createResponse = await axios.post(`${BASE_URL}${endpoint}`, createPayload, { headers });
      return createResponse.data.id;
    }
    throw error;
  }
}

// Функція для створення транзакції
async function createTransaction(tx) {
  try {
    const categoryType = tx.transactionType === 'INC' ? 'income' : 'expense';
    const categoryId = await ensureEntityExists(
      `categories/${categoryType}`,
      tx.category,
      { label: tx.category }
    );

    const tagIds = await Promise.all(
      tx.tags.map(tag => ensureEntityExists('tags', tag, { label: tag }))
    );

    const projectId = await ensureEntityExists(
      'projects',
      tx.project,
      { label: tx.project }
    );

    const accountId = await ensureEntityExists(
      'accounts',
      tx.iban,
      { label: tx.iban, currency: tx.currency }
    );

    const payload = {
      externalId: tx.id,
      categoryId,
      tagIds,
      projectId,
      date: new Date(tx.date).getTime(),
      dateOfPayment: new Date(tx.dealDate).getTime(),
      comment: tx.comment,
      [tx.transactionType === 'INC' ? 'accountToId' : 'accountFromId']: accountId,
      amount: tx.sum,
      transactionCurrency: tx.currency,
    };

    const endpoint = tx.transactionType === 'INC' ? 'operations/income' : 'operations/expense';
    const response = await axios.post(`${BASE_URL}${endpoint}`, payload, { headers });

    console.log(`Транзакція ${tx.id} створена:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Помилка для ${tx.id}:`, error.response ? error.response.data : error.message);
    return null;
  }
}

// Налаштування вебхука
async function setupWebhook(webhookUrl) {
  const cleanWebhookUrl = webhookUrl.replace(/\/+$/, '');
  const webhookPayload = {
    name: 'TransactionCreatedWebhook',
    url: `${cleanWebhookUrl}/webhook`,
  };
  try {
    const response = await axios.post(`${BASE_URL}webhooks`, webhookPayload, { headers });
    console.log('Вебхук налаштовано:', response.data);
  } catch (error) {
    console.error('Помилка налаштування вебхука:', error.response ? error.response.data : error.message);
  }
}

// Обробка вебхука
app.use(express.json());
app.post('/webhook', (req, res) => {
  const webhookData = req.body;
  console.log('Отримано вебхук на /webhook:', webhookData);
  webhookResults.push(webhookData);
  res.status(200).send('OK');
  if (webhookResults.length === transactions.length) {
    console.log('Усі вебхуки отримано, завершуємо програму...');
    server.close(() => {
      console.log('Програма виконана, усі дані завантажено.');
      process.exit(0);
    });
  }
});
app.post('//webhook', (req, res) => {
  const webhookData = req.body;
  console.log('Отримано вебхук на //webhook:', webhookData);
  webhookResults.push(webhookData);
  res.status(200).send('OK');
  if (webhookResults.length === transactions.length) {
    console.log('Усі вебхуки отримано, завершуємо програму...');
    server.close(() => {
      console.log('Програма виконана, усі дані завантажено.');
      process.exit(0);
    });
  }
});

// Основна функція
async function processTransactions() {
  const results = [];
  for (const tx of transactions) {
    const result = await createTransaction(tx);
    if (result) results.push(result);
  }
  console.log('Результати від API:', JSON.stringify(results, null, 2));
  return results;
}

// Запуск
(async () => {
  try {
    const port = 3000;
    server = app.listen(port, () => console.log(`Сервер для вебхуків запущено на порту ${port}`));

    const ngrokUrl = 'https://e4d4-194-107-178-203.ngrok-free.app'; // Оновити на актуальний ngrok URL
    await setupWebhook(ngrokUrl);

    await processTransactions();

    console.log('Чекаємо вебхуки 10 секунд...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('Результати від вебхуків:', JSON.stringify(webhookResults, null, 2));

    if (webhookResults.length === transactions.length) {
      console.log('Усі вебхуки отримано, завершуємо програму...');
      server.close(() => {
        console.log('Програма виконана, усі дані завантажено.');
        process.exit(0);
      });
    } else {
      console.log('Не всі вебхуки отримано за 10 секунд, сервер продовжує слухати...');
    }
  } catch (error) {
    console.error('Загальна помилка:', error);
    server.close(() => process.exit(1));
  }
})();