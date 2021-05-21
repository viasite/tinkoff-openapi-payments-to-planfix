const {tinkoffRequest} = require('./tinkoffApi');

async function getBalance() {
  const accounts = await tinkoffRequest('/bank-accounts');
  if (!accounts || !accounts[0] || !accounts[0].balance || !accounts[0].balance.otb) return false;
  return parseInt(accounts[0].balance.otb);
}

async function start() {
  console.log(await getBalance());

  // testPaymentTaskSearch();
  // testSendPayment();
}

start();
