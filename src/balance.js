const {tinkoffRequest} = require('./tinkoffApi');
const config = require('../.config.js');

async function getBalance() {
  const accounts = await tinkoffRequest('/bank-accounts');
  if (!accounts || !accounts[0] || !accounts[0].balance || !accounts[0].balance.otb) return false;
  // console.log(accounts[0]);
  const overdraft = config.tinkoff.overdraft || 0;
  return parseInt(accounts[0].balance.otb - overdraft);
}

async function start() {
  console.log(await getBalance());

  // testPaymentTaskSearch();
  // testSendPayment();
}

start();
