const https = require('https');
const http = require('http');  // For development (non-HTTPS)
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import the cors package
const { promises: fs, mkdirSync, existsSync, createReadStream, createWriteStream, readFileSync } = require('fs');
require('dotenv').config();
const { createTransport } = require('nodemailer');
const { registerFont, createCanvas, loadImage } = require('canvas');
const csv = require('csv-parser');
const inquirer = require('inquirer');

// Check if the environment is development or production
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const port = 3000;

// If in production, configure HTTPS options
let server;
if (isProduction) {
  const options = {
    key: readFileSync('/etc/ssl/private/selfsigned.key'),
    cert: readFileSync('/etc/ssl/private/selfsigned.crt')
  };

  // Create HTTPS server in production
  server = https.createServer(options, app);
  console.log('Running in production with HTTPS.');
} else {
  // For development, create an HTTP server
  server = http.createServer(app);
  console.log('Running in development with HTTP (no SSL).');
}

app.use(cors()); // Use CORS middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Serve static files from the public directory

const extractedCSV = [];

let message;
let certInfo;
let emailInfo;

// Read valid emails from verify.txt
async function loadValidEmails() {
    const data = await fs.promises.readFile('verify.txt', 'utf-8');
    return data.split('\n').map(email => email.trim());
}

// Check if the email is valid
async function isValidEmail(email) {
    const validEmails = await loadValidEmails();
    return validEmails.includes(email);
}

// Serve the HTML form from the public folder
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html'); // Send the HTML file
});

app.post('/generate', async (req, res) => {
    const { name, email } = req.body;

    // Check if the email is in the list of valid emails
    const validEmail = await isValidEmail(email);
    if (!validEmail) {
        return res.status(400).send("Email is not valid for certificate generation.");
    }

    const certFilePath = await createCert(capitalizeEachWord(name), 'local'); // Generate cert and get the path

    // Use res.download to trigger the file download
    res.download(certFilePath, `${capitalizeEachWord(name)}-Techniki-Certificate.png`, (err) => {
        if (err) {
            console.error("Error downloading the file:", err);
            res.status(500).send("Error downloading the certificate.");
        }
    });
});


let certPrompts = [{
    type: "input",
    name: "csvFilePath",
    message: "Please enter the filepath of your csv",
},
{
    type: "input",
    name: "certFilePath",
    message: "Please enter the filepath of your png image cert",
},
];

let emailPrompts = [{
    type: "input",
    name: "emailSubject",
    message: "Please enter your email subject",
},
{
    type: "input",
    name: "messageFilePath",
    message: "Please enter the filepath of your email message txt file",
},
];

async function main() {
    certInfo = await inquirer.prompt(certPrompts);

    createReadStream(certInfo.csvFilePath)
        .pipe(csv())
        .on('data', (data) => extractedCSV.push(data));

    let answer = await inquirer.prompt({
        type: "list",
        name: "type",
        message: "Do you want to generate certificate locally or generate certificate and automatically send to their emails?",
        choices: ["Generate Locally", "Generate and send email automatically"]
    });

    if (answer.type === "Generate Locally") {
        for (var index in extractedCSV) {
            await createCert(capitalizeEachWord(extractedCSV[index].name), 'local')
        }
    } else {
        emailInfo = await inquirer.prompt(emailPrompts);
        sendEmail();
    }
}

main();

// Listen on port 3000
server.listen(3000, () => {
    console.log(`Server is running on ${isProduction ? 'https' : 'http'}://localhost:3000`);
});

async function readMessageTxt() {
    let file = await fs.readFile(emailInfo.messageFilePath, 'utf8');
    message = file;
}

async function sendEmail() {
    await readMessageTxt();
    //Login your email
    let transporter = createTransport({
        //TODO Change this service if you need to. Check this docs https://nodemailer.com/smtp/well-known/
        service: "Outlook365",
        //TODO You can comment out the service above and use the below options for custom smtp server. Check this docs https://nodemailer.com/smtp/
        // host: "smtp.office365.com",
        // port: 587,
        // secure: false,
        // tls: { ciphers: 'SSLv3' }
        //TODO To change this go to .env
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS,
        },
    });

    //Send to receivers from csv file
    for (var index in extractedCSV) {
        try {
            await transporter.sendMail({
                //TODO Change this to sender name
                from: `"Nicolei Esperida" <${process.env.EMAIL}>`,
                to: extractedCSV[index].email,
                //TODO Change email subject
                subject: emailInfo.emailSubject,
                //This is our whole email body with greetings
                text: `Hello ${capitalizeEachWord(extractedCSV[index].name)},\n\n` + message,
                attachments: [
                    {
                        filename: `${capitalizeEachWord(extractedCSV[index].name)}.png`,
                        path: await createCert(capitalizeEachWord(extractedCSV[index].name), 'email'),
                    },
                    //TODO if you want to add more attachment other than the certificate you can check this docs https://nodemailer.com/message/attachments/
                ],
            });

            console.log(`Message sent to ${extractedCSV[index].email}`);
        } catch (error) {
            console.log(error);
            console.log(`Didn't send email to ${extractedCSV[index].email}`);
        }
    }
}

//This doesn't respect the roman numerals in name like 'II, III etc'
function capitalizeEachWord(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function createCert(name, type) {
    registerFont('src/fonts/GreatVibes-Regular.ttf', { family: 'Great Vibes' });

    const certImage = await loadImage(certInfo.certFilePath);
    const canvas = createCanvas(certImage.width, certImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(certImage, 0, 0, canvas.width, canvas.height);

    ctx.font = '100px "Great Vibes"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    const textWidth = ctx.measureText(name).width;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.fillText(name, centerX, centerY);

    if (type === 'local') {
        return createLocalCert(name, canvas); // Return the file path
    } else if (type === 'email') {
        return canvas.toDataURL();
    }
}

async function createLocalCert(name, canvas) {
    const dir = __dirname + '/cert/';
    if (!existsSync(dir)) {
        mkdirSync(dir);
    }
    
    const filePath = `${dir}${name}.png`;
    const out = createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    
    stream.pipe(out);
    return new Promise((resolve, reject) => {
        out.on('finish', () => {
            console.log(`Certificate of ${name} was created.`);
            resolve(filePath); // Resolve the promise with the file path
        });
        out.on('error', reject); // Handle any error
    });
}
