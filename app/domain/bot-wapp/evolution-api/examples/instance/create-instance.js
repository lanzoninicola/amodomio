// CREATE INSTANCE

import { url } from "../index.js";

const body = {
  instanceName: "amodomio-bot",
  number: "5546991272525",
  integration: "WHATSAPP-BUSINESS",
  token: "429683C4C977415CAAFCCE10F7D57E11",
};

const options = {
  method: "POST",
  headers: {
    apikey: "429683C4C977415CAAFCCE10F7D57E11",
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
};

fetch(`${url}/instance/create`, options)
  .then((response) => response.json())
  .then((response) => console.log(response))
  .catch((err) => console.error(err));
