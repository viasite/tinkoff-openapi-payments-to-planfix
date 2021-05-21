const axios = require('axios');
const config = require('../.config.js');

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
    console.error(`error ${path}: ${error.response.status}:  ${JSON.stringify(error.response.data)}`);
    return false;
  }
}

module.exports = {
  tinkoffRequest,
}