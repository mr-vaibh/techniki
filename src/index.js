import { promises as fs, createReadStream, createWriteStream } from 'fs';
import { registerFont, createCanvas, loadImage } from 'canvas';
import path from 'path';

// const verifyFilePath = path.resolve('./src/verify.txt');
// const certTemplatePath = path.resolve('./src/template/Ethical-Hacking-Workshop.png');

// Path to the verify folder
const verifyFolderPath = path.resolve('./src/verify');
const fontPath = path.resolve('./src/fonts/GreatVibes-Regular.ttf');

async function loadValidEmails(event) {
    // Path to the specific CSV file based on the event
    const filePath = path.join(verifyFolderPath, `${event}.csv`);

    try {
        // Use fs.promises.access to check if the file exists
        await fs.promises.access(filePath, fs.constants.F_OK);
    } catch (error) {
        throw new Error(`Event file ${event}.csv does not exist.`);
    }

    // Read the CSV file asynchronously and parse it
    const data = await fs.promises.readFile(filePath, 'utf-8');
    const records = [];

    return new Promise((resolve, reject) => {
        csvParse(data, { delimiter: ',', trim: true }, (err, output) => {
            if (err) {
                reject("Error parsing CSV file");
            } else {
                // Create a Set of emails for faster lookup
                for (const [name, email] of output) {
                    if (email) {
                        records.push({ name, email });
                    }
                }
                resolve(records);
            }
        });
    });
}

async function isValidEmail(name, email, event) {
    const validEmails = await loadValidEmails(event);

    // Check if email exists in the valid list
    const user = validEmails.find(user => user.email === email);

    // If name in CSV is "null", we check if we match the email regardless of the name
    if (user) {
        // If name in the CSV is "null", use the provided name from the request
        if (user.name === 'null') {
            user.name = name;
        }
        return { valid: true, userName: user.name };
    } else {
        return { valid: false };
    }
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { name, email, event } = req.body;

        // Validate email and possibly adjust the name if needed
        try {
            const { valid, userName } = await isValidEmail(name, email, event);

            if (!valid) {
                return res.status(400).send("Email is not valid for certificate generation.");
            }

            // Generate the certificate using the name to display (either from CSV or user input)
            const certFilePath = await createCert(capitalizeEachWord(userName), event, 'local');

            // Stream the certificate file back to the client
            const fileStream = createReadStream(certFilePath);
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Content-Disposition', `attachment; filename=${capitalizeEachWord(userName)}-Techniki-Certificate.png`);
            fileStream.pipe(res).on('finish', () => {
                console.log(`Certificate of ${userName} was sent.`);
            }).on('error', (err) => {
                console.error("Error sending the file:", err);
                return res.status(500).send("Error downloading the certificate.");
            });

        } catch (error) {
            console.error(error);
            return res.status(500).send("Error processing the request.");
        }
    } else {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}

async function createCert(name, eventCertificateTemplate, type) {
    registerFont(fontPath, { family: 'Great Vibes' });

    const certTemplatePath = path.resolve(`./src/template/${eventCertificateTemplate}.png`);

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
