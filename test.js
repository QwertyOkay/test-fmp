// const axios = require('axios');
// const { ensureEntityExists } = require('../index'); // Імпортуй функцію з index.js

// jest.mock('axios'); // Мокуємо axios, щоб не робити реальні запити

// describe('ensureEntityExists', () => {
//   it('повертає ID, якщо сутність існує', async () => {
//     axios.get.mockResolvedValue({ data: [{ id: '123' }] });
//     const result = await ensureEntityExists('categories/expense', 'Food', { label: 'Food' });
//     expect(result).toBe('123');
//   });

//   it('створює сутність, якщо її немає', async () => {
//     axios.get.mockRejectedValue({ response: { status: 404 } });
//     axios.post.mockResolvedValue({ data: { id: '456' } });
//     const result = await ensureEntityExists('categories/expense', 'Food', { label: 'Food' });
//     expect(result).toBe('456');
//   });
// });