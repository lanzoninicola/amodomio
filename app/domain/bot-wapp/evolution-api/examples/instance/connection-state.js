const options = { method: 'GET', headers: { apikey: '429683C4C977415CAAFCCE10F7D57E11' } };

fetch('http://191.101.234.115:8088/instance/connectionState/amodomio-bot', options)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));