// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

let contractSignaturePad;
let withdrawalSignaturePad;
let pdfDoc = null;
let pageNum = 1;
let pdfId = null;

// Get the PDF ID from the URL
function getPdfId() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.indexOf('sign') + 1];
}

// Resize canvas
function resizeCanvas(canvas) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
}

// Initialize signature pads
function initSignaturePads() {
    // Contract signature pad
    const contractCanvas = document.getElementById('signature-pad');
    resizeCanvas(contractCanvas);
    contractSignaturePad = new SignaturePad(contractCanvas, {
        backgroundColor: 'rgb(255, 255, 255)'
    });

    // Withdrawal signature pad
    const withdrawalCanvas = document.getElementById('withdrawal-signature-pad');
    resizeCanvas(withdrawalCanvas);
    withdrawalSignaturePad = new SignaturePad(withdrawalCanvas, {
        backgroundColor: 'rgb(255, 255, 255)'
    });

    // Handle window resize
    window.addEventListener('resize', () => {
        resizeCanvas(contractCanvas);
        resizeCanvas(withdrawalCanvas);
        contractSignaturePad.clear();
        withdrawalSignaturePad.clear();
    });

    // Clear signature buttons
    document.getElementById('clear-signature').addEventListener('click', () => {
        contractSignaturePad.clear();
        updateSignatureStatus('signature-pad', false);
    });

    document.getElementById('clear-withdrawal-signature').addEventListener('click', () => {
        withdrawalSignaturePad.clear();
        updateSignatureStatus('withdrawal-signature-pad', false);
    });

    // Handle withdrawal checkbox
    const withdrawalCheckbox = document.getElementById('withdrawal-checkbox');
    const withdrawalSignatureCanvas = document.getElementById('withdrawal-signature-pad');
    const clearWithdrawalButton = document.getElementById('clear-withdrawal-signature');

    withdrawalCheckbox.addEventListener('change', function() {
        const signatureGroup = withdrawalSignatureCanvas.closest('.signature-group');
        
        if (this.checked) {
            withdrawalSignatureCanvas.style.opacity = '1';
            withdrawalSignatureCanvas.style.pointerEvents = 'auto';
            clearWithdrawalButton.disabled = false;
            signatureGroup.style.opacity = '1';
        } else {
            withdrawalSignatureCanvas.style.opacity = '0.5';
            withdrawalSignatureCanvas.style.pointerEvents = 'none';
            clearWithdrawalButton.disabled = true;
            signatureGroup.style.opacity = '0.5';
            withdrawalSignaturePad.clear();
            updateSignatureStatus('withdrawal-signature-pad', false);
        }
    });

    // Initial withdrawal signature pad state
    withdrawalCheckbox.dispatchEvent(new Event('change'));
}

// Handle signature status
function updateSignatureStatus(canvasId, isSigned) {
    const canvas = document.getElementById(canvasId);
    const statusIndicator = canvas.closest('.signature-group').querySelector('.signature-status');
    
    if (isSigned) {
        statusIndicator.classList.add('signed');
    } else {
        statusIndicator.classList.remove('signed');
    }
}

// Load and render PDF
async function loadPDF() {
    try {
        pdfId = getPdfId();
        const response = await fetch(`/api/pdf/${pdfId}`);
        if (!response.ok) {
            throw new Error('PDF nicht gefunden');
        }
        const pdfData = await response.arrayBuffer();
        
        // Load PDF document
        pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        
        // Clear PDF container
        const pdfContainer = document.getElementById('pdf-pages');
        pdfContainer.innerHTML = '';
        
        // Render all pages
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            await renderPage(pageNum, pdfContainer);
        }
    } catch (error) {
        console.error('Fehler beim Laden des PDFs:', error);
        document.getElementById('error-message').textContent = 'Fehler beim Laden des PDFs: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
}

// Render PDF page
async function renderPage(num, container) {
    try {
        const page = await pdfDoc.getPage(num);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match PDF page
        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Add margin between pages
        canvas.style.marginBottom = '20px';
        
        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        container.appendChild(canvas);
        await page.render(renderContext).promise;
    } catch (error) {
        console.error('Fehler beim Rendern der PDF-Seite:', error);
        document.getElementById('error-message').textContent = 'Fehler beim Rendern der PDF-Seite: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
}

// Handle form submission
document.getElementById('signature-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear all previous error messages
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
        el.textContent = '';
    });

    let hasErrors = false;

    // Validate all required fields
    const requiredFields = {
        'fullName': 'Bitte geben Sie Ihren Namen ein',
        'location': 'Bitte geben Sie Ihren Ort ein',
        'email': 'Bitte geben Sie Ihre E-Mail-Adresse ein'
    };

    for (const [fieldId, errorMessage] of Object.entries(requiredFields)) {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            const errorElement = field.parentElement.querySelector('.error-message');
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
            if (!hasErrors) {
                field.focus();
                hasErrors = true;
            }
        }
    }

    // Validate terms checkbox
    if (!document.getElementById('terms').checked) {
        const errorElement = document.getElementById('terms').closest('.checkbox-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte stimmen Sie den Vertragsbedingungen zu';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    // Validate contract signature
    if (contractSignaturePad.isEmpty()) {
        const errorElement = document.getElementById('signature-pad').closest('.signature-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte setzen Sie Ihre Vertragsunterschrift';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    // Validate withdrawal checkbox and signature
    const withdrawalCheckbox = document.getElementById('withdrawal-checkbox');
    if (!withdrawalCheckbox.checked) {
        const errorElement = withdrawalCheckbox.closest('.checkbox-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte stimmen Sie dem Erlöschen des Widerrufsrechts zu';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    if (withdrawalSignaturePad.isEmpty()) {
        const errorElement = document.getElementById('withdrawal-signature-pad').closest('.signature-group').querySelector('.error-message');
        errorElement.textContent = 'Bitte setzen Sie Ihre Unterschrift für das Erlöschen des Widerrufsrechts';
        errorElement.style.display = 'block';
        hasErrors = true;
    }

    if (hasErrors) {
        return;
    }

    const formData = {
        fullName: document.getElementById('fullName').value,
        location: document.getElementById('location').value,
        email: document.getElementById('email').value,
        signature: contractSignaturePad.toDataURL(),
        withdrawalAccepted: withdrawalCheckbox.checked,
        withdrawalSignature: withdrawalCheckbox.checked ? withdrawalSignaturePad.toDataURL() : null,
        pdfId: pdfId
    };

    try {
        const response = await fetch('/api/sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error('Fehler beim Signieren des PDFs');
        }

        const result = await response.json();
        
        // Show success message with download link
        const successMessage = document.getElementById('success-message');
        successMessage.innerHTML = `
            PDF erfolgreich signiert!
            <a href="${result.pdfUrl}" target="_blank">PDF herunterladen</a>
        `;
        successMessage.style.display = 'block';
        
        // Hide error message if visible
        document.getElementById('error-message').style.display = 'none';
        
        // Disable form
        document.getElementById('submit-form').disabled = true;
        contractSignaturePad.off();
        withdrawalSignaturePad.off();

    } catch (error) {
        console.error('Fehler beim Signieren:', error);
        document.getElementById('error-message').textContent = 'Fehler beim Signieren: ' + error.message;
        document.getElementById('error-message').style.display = 'block';
    }
});

// Initialize when page loads
window.addEventListener('load', () => {
    initSignaturePads();
    
    // Monitor signature pads for changes after initialization
    ['signature-pad', 'withdrawal-signature-pad'].forEach(id => {
        const pad = id === 'signature-pad' ? contractSignaturePad : withdrawalSignaturePad;
        
        pad.addEventListener('endStroke', () => {
            updateSignatureStatus(id, !pad.isEmpty());
        });
    });
    
    loadPDF();
});
