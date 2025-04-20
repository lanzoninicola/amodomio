import { url } from "../index.js";

const message = {
    text: "cucumiim",
    delay: 123,
    number: "5546991052049",
    linkPreview: false,
    mentionsEveryOne: false,
    mentioned: ["5546991052049"],
};



const options = {
    method: 'POST',
    headers: { apikey: '429683C4C977415CAAFCCE10F7D57E11', 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
};

fetch(`${url}/message/sendText/amodomio-bot`, options)
    .then(response => response.json())
    .then(response => {
        console.log({
            response,
            message: response.response.message
        })
    })
    .catch(err => console.error(err));