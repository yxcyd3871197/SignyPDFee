const express = require('express');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pdfConfig = require('./pdfConfig');
const dataUriToBuffer = require('data-uri-to-buffer'); // Für die Unterschrift

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Multer configuration for file uploads
const multer = require('multer');
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
        const lastPage = pages[pages.length - 1]; // Add signature to the last page
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Draw labels and text fields
        const textFields = {
            fullName,
            email,
            location,
            date: date || new Date().toLocaleDateString('de-DE')
        };

        // Draw labels and corresponding text fields
        for (const [field, value] of Object.entries(textFields)) {
            if (pdfConfig.labels[field]) {
                // Draw label
                const labelConfig = pdfConfig.labels[field];
                lastPage.drawText(labelConfig.text, {
                    x: labelConfig.x,
                    y: labelConfig.y,
                    size: labelConfig.fontSize,
                    font: helveticaFont,
                    color: rgb(labelConfig.color.r, labelConfig.color.g, labelConfig.color.b)
                });

                // Draw text field value
                if (value && pdfConfig.textFields[field]) {
                    const fieldConfig = pdfConfig.textFields[field];
                    lastPage.drawText(value, {
                        x: fieldConfig.x,
                        y: fieldConfig.y,
                        size: fieldConfig.fontSize,
                        font: helveticaFont,
                        color: rgb(fieldConfig.color.r, fieldConfig.color.g, fieldConfig.color.b)
                    });
                }
            }
        }

        // Add contract signature to PDF
        if (signature) {
            try {
                const signatureImageBytes = dataUriToBuffer(signature);
                const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
                lastPage.drawImage(signatureImage, {
                    x: pdfConfig.contractSignature.x,
                    y: pdfConfig.contractSignature.y,
                    width: pdfConfig.contractSignature.width,
                    height: pdfConfig.contractSignature.height,
                });

                // Draw a line under the signature
                lastPage.drawLine({
                    start: { x: pdfConfig.contractSignature.x, y: pdfConfig.contractSignature.y },
                    end: { x: pdfConfig.contractSignature.x + pdfConfig.contractSignature.width, y: pdfConfig.contractSignature.y },
                    thickness: 1,
                    color: rgb(0, 0, 0),
                });

                // Draw contract signature label
                lastPage.drawText(pdfConfig.contractSignature.label.text, {
                    x: pdfConfig.contractSignature.label.x,
                    y: pdfConfig.contractSignature.label.y,
                    size: pdfConfig.contractSignature.label.fontSize,
                    font: helveticaFont,
                    color: rgb(
                        pdfConfig.contractSignature.label.color.r,
                        pdfConfig.contractSignature.label.color.g,
                        pdfConfig.contractSignature.label.color.b
                    )
                });
            } catch (error) {
                console.error("Fehler beim Einfügen der Vertragsunterschrift:", error);
                res.status(500).json({ error: "Fehler beim Einfügen der Vertragsunterschrift: " + error.message });
                return;
            }
        }

        // Add withdrawal signature to PDF if accepted
        if (withdrawalAccepted && withdrawalSignature) {
            try {
                const withdrawalImageBytes = dataUriToBuffer(withdrawalSignature);
                const withdrawalImage = await pdfDoc.embedPng(withdrawalImageBytes);
                lastPage.drawImage(withdrawalImage, {
                    x: pdfConfig.withdrawalSignature.x,
                    y: pdfConfig.withdrawalSignature.y,
                    width: pdfConfig.withdrawalSignature.width,
                    height: pdfConfig.withdrawalSignature.height,
                });

                // Draw a line under the withdrawal signature
                lastPage.drawLine({
                    start: { x: pdfConfig.withdrawalSignature.x, y: pdfConfig.withdrawalSignature.y },
                    end: { x: pdfConfig.withdrawalSignature.x + pdfConfig.withdrawalSignature.width, y: pdfConfig.withdrawalSignature.y },
                    thickness: 1,
                    color: rgb(0, 0, 0),
                });

                // Draw withdrawal signature label
                lastPage.drawText(pdfConfig.withdrawalSignature.label.text, {
                    x: pdfConfig.withdrawalSignature.label.x,
                    y: pdfConfig.withdrawalSignature.label.y,
                    size: pdfConfig.withdrawalSignature.label.fontSize,
                    font: helveticaFont,
                    color: rgb(
                        pdfConfig.withdrawalSignature.label.color.r,
                        pdfConfig.withdrawalSignature.label.color.g,
                        pdfConfig.withdrawalSignature.label.color.b
                    )
                });
            } catch (error) {
                console.error("Fehler beim Einfügen der Widerrufsunterschrift:", error);
                res.status(500).json({ error: "Fehler beim Einfügen der Widerrufsunterschrift: " + error.message });
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