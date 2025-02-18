import express from 'express';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { dataUriToBuffer } from 'data-uri-to-buffer';
import multer from 'multer';
import pdfConfig from './pdfConfig.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Adds signature and fields to a PDF page
 * @param {PDFPage} page - The PDF page to add content to
 * @param {Object} signatureConfig - Configuration for signature placement
 * @param {string} signatureData - Base64 encoded signature image data
 * @param {Object} fields - Text fields to add to the page
 * @param {PDFDocument} pdfDoc - The PDF document instance
 * @param {PDFFont} helveticaFont - The embedded Helvetica font
 */
async function addSignatureToPage(page, signatureConfig, signatureData, fields, pdfDoc, helveticaFont) {
    try {
        const spacing = 25; // Spacing between fields

        // Draw text fields in order
        const fieldOrder = ['fullName', 'email', 'location', 'date'];
        const startY = signatureConfig.textBlockY;

        fieldOrder.forEach((fieldName, index) => {
            const y = startY - (index * spacing);
            const value = fields[fieldName];
            const labelText = pdfConfig.labels[fieldName].text;
            
            // Draw label
            page.drawText(labelText, {
                x: 150,
                y,
                size: 12,
                font: helveticaFont,
                color: rgb(0, 0, 0)
            });

            // Draw value
            page.drawText(value, {
                x: 250,
                y,
                size: 12,
                font: helveticaFont,
                color: rgb(0, 0, 0)
            });
        });

        // Draw signature label
        page.drawText(signatureConfig.label.text, {
            x: 150,
            y: startY - (fieldOrder.length * spacing) - 10,
            size: 12,
            font: helveticaFont,
            color: rgb(0, 0, 0)
        });

        // Draw signature
        const signatureImageBytes = Buffer.from(signatureData.split(',')[1], 'base64');
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        
        page.drawImage(signatureImage, {
            x: signatureConfig.x,
            y: signatureConfig.y,
            width: signatureConfig.width,
            height: signatureConfig.height,
        });
    } catch (error) {
        throw new Error(`Fehler beim Einfügen der Unterschrift: ${error.message}`);
    }
}

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Multer configuration for file uploads
const storage = multer.memoryStorage(); // Store the file in memory
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the initial template PDF
app.get('/template', async (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'templates', 'Vertrag-Darmgesundheitscoach-Sabina-Empl.pdf');
        const templateBytes = await fs.readFile(templatePath);
        res.contentType('application/pdf');
        res.send(templateBytes);
    } catch (error) {
        console.error('Error serving template PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fixed webhook URL
const WEBHOOK_URL = 'https://hook.eu2.make.com/3vxjb8gsift0j84dj4gtrm1sbbq19kon';

// Store PDF data in memory (in production, use a database)
const pdfStore = new Map();

app.post('/api/pdf-upload', upload.single('pdf'), async (req, res) => {
    try {
        let pdfBytes;
        if (req.file) {
            // PDF file uploaded
            pdfBytes = req.file.buffer;
        } else if (req.body.base64) {
            // Base64 data provided
            pdfBytes = dataUriToBuffer(req.body.base64);
        } else {
            return res.status(400).send("No PDF file or base64 data provided");
        }

        const pdfId = uuidv4();
        const filename = 'uploaded_' + pdfId + '.pdf';
        await uploadPdfToCloudBucket(pdfBytes, filename);

        const pdfUrl = await getCloudBucketUrl(filename);
        const signUrl = `/sign/${pdfId}`;

        // Store PDF data with fixed webhook URL
        pdfStore.set(pdfId, {
            filename,
            pdfUrl,
            signUrl,
            webhookUrl: WEBHOOK_URL
        });

        res.json({ pdfUrl, signUrl });

    } catch (error) {
        console.error('Error processing PDF upload:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/pdf-config', async (req, res) => {
    try {
        const {
            fullName,
            location,
            email,
            signature,
            withdrawalSignature,
            withdrawalAccepted,
            date
        } = req.body;

        if (!fullName || !location || !email || !signature) {
            return res.status(400).json({ error: 'Alle Felder müssen ausgefüllt werden.' });
        }

        if (withdrawalAccepted && !withdrawalSignature) {
            return res.status(400).json({ error: 'Unterschrift für das Erlöschen des Widerrufsrechts fehlt.' });
        }

        // Load the template PDF
        const templatePath = path.join(__dirname, 'templates', 'Vertrag-Darmgesundheitscoach-Sabina-Empl.pdf');
        const templateBytes = await fs.readFile(templatePath);
        const pdfDoc = await PDFDocument.load(templateBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const textFields = {
            fullName,
            email,
            location,
            date: date || new Date().toLocaleDateString('de-DE')
        };

        // Add withdrawal signature to page 9
        if (withdrawalAccepted && withdrawalSignature) {
            try {
                await addSignatureToPage(
                    pages[pdfConfig.withdrawalSignature.page],
                    pdfConfig.withdrawalSignature,
                    withdrawalSignature,
                    textFields,
                    pdfDoc,
                    helveticaFont
                );
            } catch (error) {
                console.error("Fehler beim Einfügen der Widerrufsunterschrift:", error);
                res.status(500).json({ error: "Fehler beim Einfügen der Widerrufsunterschrift: " + error.message });
                return;
            }
        }

        // Add contract signature to page 10
        if (signature) {
            try {
                await addSignatureToPage(
                    pages[pdfConfig.contractSignature.page],
                    pdfConfig.contractSignature,
                    signature,
                    textFields,
                    pdfDoc,
                    helveticaFont
                );
            } catch (error) {
                console.error("Fehler beim Einfügen der Vertragsunterschrift:", error);
                res.status(500).json({ error: "Fehler beim Einfügen der Vertragsunterschrift: " + error.message });
                return;
            }
        }

        const pdfBytes = await pdfDoc.save();
        const filename = 'ausbildungsvertrag_' + uuidv4() + '.pdf';
        await uploadPdfToCloudBucket(pdfBytes, filename);

        const pdfUrl = await getCloudBucketUrl(filename);
        res.json({ pdfUrl });

        // Send webhook notification
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'signed',
                    pdfUrl,
                    timestamp: new Date().toISOString()
                }),
            });
            
            if (!response.ok) {
                console.error(`Webhook failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error sending webhook:', error);
        }

    } catch (error) {
        console.error('Fehler bei der PDF-Konfiguration:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve the signing page
app.get('/sign/:pdfId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'sign.html'));
});

// Get PDF by ID
app.get('/api/pdf/:pdfId', async (req, res) => {
    try {
        const pdfId = req.params.pdfId;
        const pdfData = pdfStore.get(pdfId);
        
        if (!pdfData) {
            return res.status(404).json({ error: 'PDF nicht gefunden' });
        }

        const pdfPath = path.join(__dirname, 'public', pdfData.filename);
        const pdfBytes = await fs.readFile(pdfPath);
        
        res.contentType('application/pdf');
        res.send(pdfBytes);
    } catch (error) {
        console.error('Error serving PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

// Handle PDF signing
app.post('/api/sign', async (req, res) => {
    try {
        const {
            fullName,
            location,
            email,
            signature,
            withdrawalAccepted,
            withdrawalSignature,
            pdfId
        } = req.body;

        if (!fullName || !location || !email || !signature || !pdfId) {
            return res.status(400).json({ error: 'Alle Felder müssen ausgefüllt werden.' });
        }

        if (withdrawalAccepted && !withdrawalSignature) {
            return res.status(400).json({ error: 'Unterschrift für das Erlöschen des Widerrufsrechts fehlt.' });
        }

        const pdfData = pdfStore.get(pdfId);
        if (!pdfData) {
            return res.status(404).json({ error: 'PDF nicht gefunden' });
        }

        // Load the PDF
        const pdfPath = path.join(__dirname, 'public', pdfData.filename);
        const pdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const textFields = {
            fullName,
            email,
            location,
            date: new Date().toLocaleDateString('de-DE')
        };

        // Add withdrawal signature if accepted
        if (withdrawalAccepted && withdrawalSignature) {
            try {
                await addSignatureToPage(
                    pages[pdfConfig.withdrawalSignature.page],
                    pdfConfig.withdrawalSignature,
                    withdrawalSignature,
                    textFields,
                    pdfDoc,
                    helveticaFont
                );
            } catch (error) {
                console.error("Fehler beim Einfügen der Widerrufsunterschrift:", error);
                res.status(500).json({ error: "Fehler beim Einfügen der Widerrufsunterschrift: " + error.message });
                return;
            }
        }

        // Add contract signature
        try {
            await addSignatureToPage(
                pages[pdfConfig.contractSignature.page],
                pdfConfig.contractSignature,
                signature,
                textFields,
                pdfDoc,
                helveticaFont
            );
        } catch (error) {
            console.error("Fehler beim Einfügen der Vertragsunterschrift:", error);
            res.status(500).json({ error: "Fehler beim Einfügen der Vertragsunterschrift: " + error.message });
            return;
        }

        // Save the signed PDF
        const signedPdfBytes = await pdfDoc.save();
        const signedFilename = 'signed_' + pdfId + '.pdf';
        await uploadPdfToCloudBucket(signedPdfBytes, signedFilename);

        const signedPdfUrl = await getCloudBucketUrl(signedFilename);

        // Send webhook notification
        try {
            const fetch = (await import('node-fetch')).default;
            await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'signed',
                    pdfUrl: signedPdfUrl,
                    signedBy: {
                        name: fullName,
                        email: email,
                        location: location
                    },
                    withdrawalAccepted: withdrawalAccepted,
                    timestamp: new Date().toISOString()
                }),
            });
        } catch (error) {
            console.error('Error sending webhook:', error);
        }

        res.json({ pdfUrl: signedPdfUrl });

    } catch (error) {
        console.error('Error signing PDF:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test route to load template PDF
app.get('/test-template', async (req, res) => {
    try {
        const templatePath = path.join(__dirname, 'templates', 'Datenblatt_13000108.pdf');
        const pdfBytes = await fs.readFile(templatePath);
        
        const pdfId = uuidv4();
        const filename = 'uploaded_' + pdfId + '.pdf';
        await uploadPdfToCloudBucket(pdfBytes, filename);

        const pdfUrl = await getCloudBucketUrl(filename);
        const signUrl = `/sign/${pdfId}`;

        // Store PDF data with fixed webhook URL
        pdfStore.set(pdfId, {
            filename,
            pdfUrl,
            signUrl,
            webhookUrl: WEBHOOK_URL
        });

        res.json({ pdfUrl, signUrl });
    } catch (error) {
        console.error('Error loading template:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server läuft auf Port ${port}`);
    console.log(`Aktuelles Verzeichnis: ${__dirname}`);
});

async function uploadPdfToCloudBucket(pdfBytes, filename) {
    // TODO: Implement Google Cloud Storage upload
    // This function should upload the pdfBytes to a Google Cloud Storage bucket
    // with the given filename.
    console.log(`Uploading ${filename} to Google Cloud Storage...`);
    const pdfPath = path.join(__dirname, 'public', filename);
    await fs.writeFile(pdfPath, pdfBytes); // Temporarily save to public folder
    console.log(`PDF-Datei gespeichert unter: ${pdfPath}`);
}

async function getCloudBucketUrl(filename) {
    // TODO: Implement Google Cloud Storage URL retrieval
    // This function should return the public URL of the PDF in Google Cloud Storage.
    console.log(`Getting Google Cloud Storage URL for ${filename}...`);
    return `/${filename}`; // Temporarily return local URL
}