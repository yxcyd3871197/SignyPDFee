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

// Store webhookUrls for PDFs
const pdfWebhooks = new Map();

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

        const filename = 'uploaded_' + uuidv4() + '.pdf';
        await uploadPdfToCloudBucket(pdfBytes, filename);

        const pdfUrl = await getCloudBucketUrl(filename);

        // Store webhook URL if provided
        if (req.body.webhookUrl) {
            pdfWebhooks.set(filename, req.body.webhookUrl);
        }

        res.json({ pdfUrl });

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
        const page9 = pages[8]; // 0-based index for page 9
        const page10 = pages[9]; // 0-based index for page 10
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Function to draw text fields on a page
        const drawTextFields = (page, yOffset = 0) => {
            // Draw labels and text fields
            for (const [field, value] of Object.entries(textFields)) {
                if (pdfConfig.labels[field]) {
                    // Draw label
                    const labelConfig = pdfConfig.labels[field];
                    page.drawText(labelConfig.text, {
                        x: labelConfig.x,
                        y: labelConfig.y + yOffset,
                        size: labelConfig.fontSize,
                        font: helveticaFont,
                        color: rgb(labelConfig.color.r, labelConfig.color.g, labelConfig.color.b)
                    });

                    // Draw text field value
                    if (value && pdfConfig.textFields[field]) {
                        const fieldConfig = pdfConfig.textFields[field];
                        page.drawText(value, {
                            x: fieldConfig.x,
                            y: fieldConfig.y + yOffset,
                            size: fieldConfig.fontSize,
                            font: helveticaFont,
                            color: rgb(fieldConfig.color.r, fieldConfig.color.g, fieldConfig.color.b)
                        });
                    }
                }
            }
        };

        const textFields = {
            fullName,
            email,
            location,
            date: date || new Date().toLocaleDateString('de-DE')
        };

        // Function to add signature and fields to a page
        const addSignatureToPage = async (page, signatureConfig, signatureData, fields) => {
            try {
                const pageWidth = page.getWidth();
                const pageHeight = page.getHeight();
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
                
                // Center the signature horizontally
                const signatureX = (pageWidth - signatureConfig.width) / 2;
                
                page.drawImage(signatureImage, {
                    x: signatureX,
                    y: startY - (fieldOrder.length * spacing) - 40, // Position below the label
                    width: signatureConfig.width,
                    height: signatureConfig.height,
                });
            } catch (error) {
                throw new Error(`Fehler beim Einfügen der Unterschrift: ${error.message}`);
            }
        };

        // Add withdrawal signature to page 9
        if (withdrawalAccepted && withdrawalSignature) {
            try {
                await addSignatureToPage(
                    pages[pdfConfig.withdrawalSignature.page],
                    pdfConfig.withdrawalSignature,
                    withdrawalSignature,
                    textFields
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
                    textFields
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

        // Send webhook notification if URL was provided during upload
        const webhookUrl = pdfWebhooks.get(filename);
        if (webhookUrl) {
            try {
                const fetch = (await import('node-fetch')).default;
                const response = await fetch(webhookUrl, {
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
                
                // Remove webhook URL after sending notification
                pdfWebhooks.delete(filename);
            } catch (error) {
                console.error('Error sending webhook:', error);
            }
        }

    } catch (error) {
        console.error('Fehler bei der PDF-Konfiguration:', error);
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