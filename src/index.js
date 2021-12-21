const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const config = require('../.config.js');
const planfixApi = require('./planfixApi');
const {tinkoffRequest} = require('./tinkoffApi');

const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ payments: [] }).write();

const isFirstRun = db.get('payments').value().length == 0;

let searchTaskComment = '';

async function start() {
  // testPaymentTaskSearch();
  // testSendPayment();
  // return;

  console.log(new Date());
  const payments = await getPayments();
  if (!payments) return;

  for (let operation of payments.operation) {
    await sendPayment(operation);
  }
  // console.log('payments: ', payments);
}

function debug(a) {
  if (config.debug) console.log(a);
}

async function getPayments() {
  debug('Tinkoff: getPayments');
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
  return payments;
}

// Отправляет в Планфикс, если нужно
async function sendPayment(operation) {
  const foundPayment = db.get('payments').find({ date: operation.date, id: operation.id }).value();
  // console.log('foundPayment: ', foundPayment);

  const writePayment = () => {
    db.get('payments').push(operation).write();
  }

  // уже известен
  if (foundPayment) {
    debug('Платёж уже известен: ' + operation.id);
    return false;
  }

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
    writePayment();
    console.log('Исходящие платежи не отправляются в Планфикс');
    return;
  }

  if (isFirstRun) {
    console.log('Пока в истории запросов нет платажей, в ПФ ничего не отправляется.');
    return;
  }

  // если найдена задача, то отправляем аналитику в неё
  const foundTask = await getPaymentTask(operation);
  console.log(searchTaskComment); // его генерит getPaymentTask
  const taskGeneral = foundTask ? foundTask.general : config.planfix.taskGeneral;

  const comment = `Входящий платёж от Тинькофф:<br><br>
  <b>Сумма:</b> ${operation.amount}<br>
  <b>Имя плательщика:</b> ${operation.payerName}<br>
  <b>Назначение платежа:</b> ${operation.paymentPurpose}<br>
  <b>ИНН плательщика:</b> ${operation.payerInn}<br>
  <b>Дата:</b> ${operation.date}<br>
  <b>Номер документа:</b> ${operation.id}<br><br>
  ${searchTaskComment}<br>
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
      task: { general: taskGeneral },
      description: comment,
      notifiedList: notifyList,
      analitics: [
        planfixApi.getAnaliticRequest(config.planfix.analiticId, {
          [config.planfix.fieldSumId]:  operation.amount, // сумма
          [config.planfix.fieldDateId]: operation.chargeDate, // дата
          [config.planfix.fieldToId]:   config.planfix.fieldToValue, // куда
          [config.planfix.fieldPurposeId]:   operation.paymentPurpose, // куда
        })
      ],
    },
  };
  const result = await planfixApi.request('action.add', request);
  writePayment();
}

function taskFilters (date, payNum) {
  const taskConfig = config.planfix.paymentTask;

  const filters = {
    filter: [
      {
        type: 102, // число
        operator: 'equal',
        value: payNum,
        field: taskConfig.fieldPaymentNumberId,
      },
      {
        type: 103, // дата
        operator: 'equal',
        value: {
          datetype: 'anotherdate',
          datefrom: date,
        },
        field: taskConfig.fieldDateId,
      }
    ],
  };

  return filters;
};

// находит задачу по реквизитам платежа: дата и номер
async function getPaymentTask(operation) {
  searchTaskComment = '';
  const info = parsePaymentPurpose(operation.paymentPurpose);
  if (!info.date || !info.payNum) return false;
  console.log(`Найден счёт: №${info.payNum} от ${info.date}`);

  const request = {
    filters: taskFilters(info.date, info.payNum)
  };
  const res = await planfixApi.request('task.getList', request);

  // если 1 задача, то победа
  if (res.tasks.$.totalCount == 1) {
    console.log('Найдена задача: ' + planfixApi.getTaskUrl(res.tasks.task.general));
    return res.tasks.task;
  }
  // если 0
  else if (res.tasks.$.totalCount == 0) {
    const msg = `Задача на оплату не найдена`;
    searchTaskComment = msg;
    console.log(msg);
    return false;
  }
  // если больше 1
  else {
    const tasks = res.tasks.task.map(task => planfixApi.getTaskUrl(task.general));

    const msg = `Найдено задач: ${res.tasks.$.totalCount}\n` + tasks.join('\n');
    searchTaskComment = msg.replace(/\n/g, '<br>');
    console.log(msg);
  }
  return false;
}

// находит дату платежа и номер счёта
function parsePaymentPurpose(msg) {
  const info = {};
  let res;

  msg = msg.replace(/\//g, '.'); // 11/11/11 -> 11.11.11

  // оплата по счету № 1 от 11.11.11г
  // оплата по счету 1 от 11.11.11г
  // оплата по сч. 1 от 11 ноября 11г
  if (res = msg.match(/(сч\.|счет.*?|№)\s*(\d+)\s+от\s+(\d+)(\.\d+\.|\s+[а-я]+\s+)(\d+)/)) {
    let day = parseInt(res[3]);

    let monthStr = res[4].replace(/\./g, '').trim();
    let month = parseInt(monthStr);

    // месяц прописью
    if (!month) {
      const monthMap = {
        'января': 1,
        'февраля': 2,
        'марта': 3,
        'апреля': 4,
        'мая': 5,
        'июня': 6,
        'июля': 7,
        'августа': 8,
        'сентября': 9,
        'октября': 10,
        'ноября': 11,
        'декабря': 12,
      }
      if (monthMap[monthStr]) month = monthMap[monthStr];
    }

    let year = parseInt(res[5]);
    if (year < 100) year += 2000; // 21г.

    const d = new Date(year, month - 1, day, 12).toISOString(); // 12, чтобы часовой пояс не поменял день

    info.date = `${d.substring(8, 10)}-${d.substring(5, 7)}-${d.substring(0, 4)}`;
    info.payNum = res[2];

    if (!month) delete(info.date);
  }

  return info;
}

async function testPaymentTaskSearch() {
  const purposes = require('../data/payments-test');
  let stats = {
    total: purposes.length,
    success: 0,
  }
  for (let purpose of purposes) {
    const info = parsePaymentPurpose(purpose);
    if (info.date && info.payNum) stats.success++;
    else console.log(purpose);
  }
  console.log('stats: ', stats);

  // const operation = db.get('payments').find({ date: '2021-02-11', id: '21' }).value();
  // const task = await getPaymentTask(operation);
  // console.log('task: ', task);
}

async function testSendPayment() {
  const op = {}; // скопировать из db.json
  sendPayment(op);
}

start();
