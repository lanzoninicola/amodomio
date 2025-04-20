import { url } from "./index.js";

const options = { method: 'GET' };

// fetch('http://191.101.234.115:8088/', options)
fetch(url, options)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));