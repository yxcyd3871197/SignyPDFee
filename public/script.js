// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';

// Initialize signature pads
const contractSignaturePad = new SignaturePad(document.getElementById('signature-pad'), {
    backgroundColor: 'rgb(255, 255, 255)'
});

const withdrawalSignaturePad = new SignaturePad(document.getElementById('withdrawal-signature-pad'), {
    backgroundColor: 'rgb(255, 255, 255)'
});

// Handle window resize
function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    ['signature-pad', 'withdrawal-signature-pad'].forEach(id => {
        const canvas = document.getElementById(id);
        const context = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        context.scale(ratio, ratio);
    });

    contractSignaturePad.clear();
    withdrawalSignaturePad.clear();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Clear signature buttons
document.getElementById('clear-signature').addEventListener('click', () => {
    contractSignaturePad.clear();
    updateSignatureStatus('signature-pad', false);
});

document.getElementById('clear-withdrawal-signature').addEventListener('click', () => {
    withdrawalSignaturePad.clear();
    updateSignatureStatus('withdrawal-signature-pad', false);
});

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

// Show error messages
function showError(message, elementId = null) {
    if (elementId) {
        // Show error under specific field
        const element = document.getElementById(elementId);
        let errorDiv = element.nextElementSibling;
        if (!errorDiv || !errorDiv.classList.contains('error-message')) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            element.parentNode.insertBefore(errorDiv, element.nextSibling);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    } else {
        // Show general error message
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }
}

// Enable/disable withdrawal signature based on checkbox
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

// Validate form fields
function validateForm() {
    let isValid = true;

    // Validate required fields
    const requiredFields = {
        'fullName': 'Bitte füllen Sie dieses Feld aus.',
        'location': 'Bitte füllen Sie dieses Feld aus.',
        'email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
    };

    for (const [fieldId, message] of Object.entries(requiredFields)) {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showError(message, fieldId);
            isValid = false;
        }
    }

    // Validate terms checkbox
    const termsCheckbox = document.getElementById('terms');
    if (!termsCheckbox.checked) {
        showError('Sie müssen den Vertragsbedingungen zustimmen, bevor Sie unterschreiben können.', 'terms');
        isValid = false;
    }

    // Validate contract signature
    if (contractSignaturePad.isEmpty()) {
        showError('Unterschrift erforderlich.', 'signature-pad');
        isValid = false;
    }

    // Validate withdrawal signature if checkbox is checked
    if (withdrawalCheckbox.checked && withdrawalSignaturePad.isEmpty()) {
        showError('Sie müssen dem Erlöschen des Widerrufsrechts zustimmen, bevor Sie unterschreiben können.', 'withdrawal-signature-pad');
        isValid = false;
    }

    if (!isValid) {
        showError('Bitte setzen Sie beide Unterschriften und bestätigen Sie beide Checkboxen, bevor Sie absenden können.');
    }

    return isValid;
}

// Form submission handler
document.getElementById('signature-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    const formData = {
        date: new Date().toLocaleDateString('de-DE'),
        fullName: document.getElementById('fullName').value,
        location: document.getElementById('location').value,
        email: document.getElementById('email').value,
        signature: contractSignaturePad.toDataURL(),
        withdrawalAccepted: withdrawalCheckbox.checked,
        withdrawalSignature: withdrawalCheckbox.checked ? withdrawalSignaturePad.toDataURL() : null
    };

    try {
        const response = await fetch('/api/pdf-config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Show success message
        const successMessage = document.getElementById('success-message');
        successMessage.textContent = 'Unterschrift erfolgreich gespeichert.';
        successMessage.style.display = 'block';
        
        // Load and display the signed PDF
        await loadPDF(data.pdfUrl);
        
        // Hide success message after 5 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);

    } catch (error) {
        console.error('Error:', error);
        showError('Fehler beim Speichern der Unterschrift: ' + error.message);
    }
});

// Monitor signature pads for changes
['signature-pad', 'withdrawal-signature-pad'].forEach(id => {
    const pad = id === 'signature-pad' ? contractSignaturePad : withdrawalSignaturePad;
    
    pad.addEventListener('endStroke', () => {
        updateSignatureStatus(id, !pad.isEmpty());
    });
});

// Function to load and display PDF
async function loadPDF(url) {
    try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const pdfPagesContainer = document.getElementById('pdf-pages');
        pdfPagesContainer.innerHTML = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            });
            
            pdfPagesContainer.appendChild(canvas);
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        showError('Fehler beim Laden der PDF: ' + error.message);
    }
}

// Load the template PDF when the page loads
loadPDF('/template');