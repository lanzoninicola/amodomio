import { url } from "../index.js";

const options = { method: 'PUT', headers: { apikey: '429683C4C977415CAAFCCE10F7D57E11' } };

fetch(`${url}/instance/restart/amodomio-bot`, options)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));