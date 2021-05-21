module.exports = {
  tinkoff: {
    apiUrl: 'https://business.tinkoff.ru/openapi/api/v1',
    inn: '', // по ИНН определяются входящие/исходящие
    accountNumber: '', // номер счёта, получается тут - https://business.tinkoff.ru/openapi/docs#operation/getApiV1Bank-accounts, можно не указывать
    token: '',
    overdraft: 1000, // вычитает из баланса
  },
  planfix: {
    account: '',
    api_url: 'https://api.planfix.ru/xml/',
    api_key: '',
    user_login: '',
    user_password: '',

    taskGeneral: 0, // номер задачи, сюда будут добавляться аналитики
    analiticId: 0, // id аналитики
    fieldSumId: 0, // id суммы
    fieldDateId: 0, // id поля даты
    fieldToId: 0, // id назначения
    fieldToValue: 'Р/С Тинькофф', // значение назначения

    paymentTask: {
      fieldDateId: 0, // дата счета
      fieldPaymentNumberId: 0, // номер счета
    },

    notifyUsers: [0], // id юзеров, которых уведомить
  }
};
