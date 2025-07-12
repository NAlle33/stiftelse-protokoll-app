// Debug script to test error handling logic
const { handleError, ErrorCode } = require('./src/utils/errorHandling');

console.log('Testing BankID error classification...');

const bankidError = new Error('BankID authentication failed');
console.log('Error message:', bankidError.message);
console.log('Lowercase message:', bankidError.message.toLowerCase());
console.log('Includes bankid:', bankidError.message.toLowerCase().includes('bankid'));

try {
  const result = handleError(bankidError, 'testOperation', 'testService');
  console.log('Result:', {
    code: result.code,
    message: result.message,
    context: result.context
  });
  console.log('Expected code:', ErrorCode.BANKID_ERROR);
  console.log('Match:', result.code === ErrorCode.BANKID_ERROR);
} catch (error) {
  console.error('Error during test:', error);
}
