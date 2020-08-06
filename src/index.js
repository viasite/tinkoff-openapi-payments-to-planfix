const axios = require('axios');
const config = require('../.config.js');

async function tinkoffRequest(path, request={}, method='get') {
  try {
    const answer = await axios.request({
      // url: 'https://6badfd7f7d9c32954a014f2fd7da808b.m.pipedream.net',
      url: config.tinkoff.apiUrl + path,
      method: method,
      params: request,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'tinkoff-payments-to-planfix',
        Authorization: `Bearer ${config.tinkoff.token}`
      },
      /* auth: {
        username: config.tinkoff.apiClient,
        password: config.tinkoff.token
      }, */
    });
  
    console.log('answer code: ', answer.status);
  
    if(answer.status != '200') {
      console.error(answer);
    }
    const data = answer.data;
    console.log('data: ', data);
    return data;
  }
  catch (error) {
    console.log(`error ${path}: ${error.response.status}: ${error.response.data}`);
    return false;
  }
}

async function getPayments() {
  // получаем номер счёта, если его нет в конфиге
  let accountNumber = config.tinkoff.accountNumber;
  if (!config.tinkoff.accountNumber) {
    const accounts = await tinkoffRequest('/bank-accounts');
    if (accounts.length != 1) {
      console.error('Больше 1 счёта не поддерживается, добавьте в конфиг tinkoff.accountNumber')
    }
    accountNumber = accounts[0].accountNumber;
  }

  // получаем платежи
  const payments = await tinkoffRequest('/bank-statement', {
    accountNumber: accountNumber
  });

  console.log('Баланс на начало периода: ', payments.saldoIn);
  console.log('Баланс на конец периода: ', payments.saldoOut);
  console.log('Обороты входящих платежей: ', payments.income);
  console.log('Обороты исходящих платежей: ', payments.outcome);

  const operationNames = {
    id: 'Номер документа',
    // uin: 'Уникальный идентификатор платежа',
    date: 'Дата документа',
    // drawDate: 'Дата списания средств с р/с плательщика',
    chargeDate: 'Дата поступления средств на р/с получателя',
    amount: 'Сумма платежа',
    payerName: 'Имя плательщика',
    payerInn: 'ИНН плательщика',
    paymentType: 'Вид платежа',
    operationType: 'Вид операции',
    paymentPurpose: 'Назначение платежа',
  }
  for (let operation of payments.operation) {
    const isOut = operation.payerInn == config.tinkoff.inn;
    console.log('\n\nПлатёж: ' + (isOut ? '-' : '+') + operation.amount);
    for(let id in operationNames) {
      console.log(`${operationNames[id]}: `, operation[id]);
    }
  }
  // console.log('payments: ', payments);
}

async function start() {
  await getPayments();
}

start();
