import { promises as fs, createReadStream, createWriteStream } from 'fs';
import { createTransport } from 'nodemailer';
import { registerFont, createCanvas, loadImage } from 'canvas';
import path from 'path';

const verifyFilePath = path.resolve('./src/verify.txt');
const certTemplatePath = path.resolve('./src/template/certificate.png');
const fontPath = path.resolve('./src/fonts/GreatVibes-Regular.ttf');

async function loadValidEmails() {
    const data = await fs.readFile(verifyFilePath, 'utf-8');
    return new Set(data.split('\n').map(email => email.trim()));
}

async function isValidEmail(email) {
    const validEmails = await loadValidEmails();
    return validEmails.has(email);
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { name, email } = req.body;

        // Validate email
        const validEmail = await isValidEmail(email);
        if (!validEmail) {
            return res.status(400).send("Email is not valid for certificate generation.");
        }

        // Generate the certificate
        const certFilePath = await createCert(capitalizeEachWord(name), 'local');

        // Stream the certificate file back to the client
        const fileStream = createReadStream(certFilePath);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename=${capitalizeEachWord(name)}-Techniki-Certificate.png`);
        fileStream.pipe(res).on('finish', () => {
            console.log(`Certificate of ${name} was sent.`);
        }).on('error', (err) => {
            console.error("Error sending the file:", err);
            return res.status(500).send("Error downloading the certificate.");
        });

    } else {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function createCert(name, type) {
    registerFont(fontPath, { family: 'Great Vibes' });

    const certImage = await loadImage(certTemplatePath);
    const canvas = createCanvas(certImage.width, certImage.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(certImage, 0, 0, canvas.width, canvas.height);

    ctx.font = '100px "Great Vibes"';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.fillText(name, centerX, centerY);

    return createLocalCert(name, canvas); // Handle local cert creation
}

async function createLocalCert(name, canvas) {
    const dir = '/tmp/'; // Vercel provides a temporary directory
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

// Utility function to capitalize each word
function capitalizeEachWord(str) {
    return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
