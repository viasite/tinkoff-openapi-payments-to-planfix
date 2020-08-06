const axios = require('axios');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const config = require('../.config.js');
const planfixApi = require('./planfixApi');

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ payments: [] }).write();

const isFirstRun = db.get('payments').value().length == 0;

async function tinkoffRequest(path, request = {}, method = 'get') {
  try {
    const answer = await axios.request({
      // url: 'https://6badfd7f7d9c32954a014f2fd7da808b.m.pipedream.net',
      url: config.tinkoff.apiUrl + path,
      method: method,
      params: request,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'tinkoff-payments-to-planfix',
        Authorization: `Bearer ${config.tinkoff.token}`,
      },
      /* auth: {
        username: config.tinkoff.apiClient,
        password: config.tinkoff.token
      }, */
    });

    // console.log('answer code: ', answer.status);

    const data = answer.data;
    // console.log('data: ', data);
    return data;
  } catch (error) {
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
      console.error('Больше 1 счёта не поддерживается, добавьте в конфиг tinkoff.accountNumber');
    }
    accountNumber = accounts[0].accountNumber;
  }

  // получаем платежи
  const payments = await tinkoffRequest('/bank-statement', {
    accountNumber: accountNumber,
  });

  console.log(new Date());
  /* console.log('Баланс на начало периода: ', payments.saldoIn);
  console.log('Баланс на конец периода: ', payments.saldoOut);
  console.log('Обороты входящих платежей: ', payments.income);
  console.log('Обороты исходящих платежей: ', payments.outcome); */

  for (let operation of payments.operation) {
    await sendPayment(operation);
  }
  // console.log('payments: ', payments);
}

// Отправляет в Планфикс, если нужно
async function sendPayment(operation) {
  const foundPayment = db.get('payments').find({ date: operation.date, id: operation.id }).value();
  // console.log('foundPayment: ', foundPayment);

  // уже известен
  if (foundPayment) {
    // console.log('Платёж уже известен');
    return false;
  }

  db.get('payments').push(operation).write();

  const isOut = operation.payerInn == config.tinkoff.inn;

  console.log('\n\nПлатёж: ' + (isOut ? '-' : '+') + operation.amount);
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
  };
  for (let id in operationNames) {
    console.log(`${operationNames[id]}: `, operation[id]);
  }

  if (isOut) {
    console.log('Исходящие платежи не отправляются в Планфикс');
    return;
  }

  if (isFirstRun) {
    console.log('Пока в истории запросов нет платажей, в ПФ ничего не отправляется.');
    return;
  }

  const comment = `Входящий платёж от Тинькофф:<br><br>
  <b>Сумма:</b> ${operation.amount}<br>
  <b>Имя плательщика:</b> ${operation.payerName}<br>
  <b>Назначение платежа:</b> ${operation.paymentPurpose}<br>;
  <b>ИНН плательщика:</b> ${operation.payerInn}<br>
  <b>Дата:</b> ${operation.date}<br>
  <b>Номер документа:</b> ${operation.id}<br>
  `;

  const notifyList =
    config.planfix.notifyUsers.length > 0
      ? {
          user: [
            config.planfix.notifyUsers.map((uid) => {
              return { id: uid };
            }),
          ],
        }
      : {};

  // отправка в Планфикс
  const request = {
    action: {
      task: { general: config.planfix.taskGeneral },
      description: comment,
      notifiedList: notifyList,
      analitics: [
        {
          analitic: {
            id: config.planfix.analiticId,
            analiticData: [
              // сумма
              {
                itemData: [
                  {
                    fieldId: config.planfix.fieldSumId,
                    value: operation.amount,
                  },
                  // дата
                  {
                    fieldId: config.planfix.fieldDateId,
                    value: operation.chargeDate,
                  },
                  // куда
                  {
                    fieldId: config.planfix.fieldToId,
                    value: config.planfix.fieldToValue,
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  };
  await planfixApi.request('action.add', request);
}

async function start() {
  await getPayments();
}

start();
