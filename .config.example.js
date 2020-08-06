module.exports = {
  tinkoff: {
    apiUrl: 'https://business.tinkoff.ru/openapi/api/v1',
    inn: '', // по ИНН определяются входящие/исходящие
    accountNumber: '', // номер счёта, получается тут - https://business.tinkoff.ru/openapi/docs#operation/getApiV1Bank-accounts, можно не указывать
    token: ''
  },
};
