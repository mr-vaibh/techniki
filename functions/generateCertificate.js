// netlify/functions/generateCertificate.js

const { promises: fs, mkdirSync, existsSync, createReadStream, createWriteStream, readFileSync } = require('fs');
const { createTransport } = require('nodemailer');
const { registerFont, createCanvas, loadImage } = require('canvas');
const csv = require('csv-parser');

let extractedCSV = [];
let certInfo;

// Load valid emails from verify.txt
async function loadValidEmails() {
    const data = await fs.readFile('src/verify.txt', 'utf-8');
    return data.split('\n').map(email => email.trim());
}

// Check if the email is valid
async function isValidEmail(email) {
    const validEmails = await loadValidEmails();
    return validEmails.includes(email);
}

// Main function to handle the event
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' })
        };
    }

    const { name, email } = JSON.parse(event.body);
    
    const validEmail = await isValidEmail(email);
    if (!validEmail) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "Email is not valid for certificate generation." })
        };
    }

    const certFilePath = await createCert(capitalizeEachWord(name));
    
    // Read the generated certificate as a buffer
    const fileBuffer = await fs.readFile(certFilePath);

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="${name}-Techniki-Certificate.png"`,
        },
        body: fileBuffer.toString('base64'),
        isBase64Encoded: true,
    };
};

// Your existing functions like createCert, createLocalCert, capitalizeEachWord, etc.

async function createCert(name, type) {
    registerFont('src/fonts/GreatVibes-Regular.ttf', { family: 'Great Vibes' });

    const certImage = await loadImage('src/template/certificate.png');
    const canvas = createCanvas(certImage.width, certImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(certImage, 0, 0, canvas.width, canvas.height);

    ctx.font = '100px "Great Vibes"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.fillText(name, centerX, centerY);

    return createLocalCert(name, canvas);
}

async function createLocalCert(name, canvas) {
    const dir = __dirname + '/cert/';
    if (!existsSync(dir)) {
        mkdirSync(dir);
    }

    const filePath = `${dir}${name}.png`;
    const out = createWriteStream(filePath);
    const stream = canvas.createPNGStream();
    
    return new Promise((resolve, reject) => {
        stream.pipe(out);
        out.on('finish', () => {
            console.log(`Certificate of ${name} was created.`);
            resolve(filePath);
        });
        out.on('error', reject);
    });
}

function capitalizeEachWord(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
